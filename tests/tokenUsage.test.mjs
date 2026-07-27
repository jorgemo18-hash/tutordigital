import { makeFakeSupabaseAdmin } from "./support/fakeSupabaseAdmin.mjs";

// recordTokenUsage: fire-and-forget real — nunca lanza, ni con datos
// incompletos ni con un fallo del insert. `admin` inyectado (no
// createSupabaseAdmin() interno) para poder testear sin credenciales
// reales, mismo criterio que resolverAlumnoIdsVisibles/fetchEstadoActual.
export async function run({ test, assert }) {
  const { recordTokenUsage } = await import("../server/lib/tokenUsage.js");

  test("inserta una fila con los tokens, el coste en USD y el fx del momento", async () => {
    const admin = makeFakeSupabaseAdmin();
    await recordTokenUsage({
      admin, tenantId: "t1", sessionId: "s1", source: "chat", model: "claude-sonnet-4-6",
      usage: { input_tokens: 1000, output_tokens: 500 },
    });
    const rows = admin._state.tables.ai_token_usage;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].tenant_id, "t1");
    assert.equal(rows[0].session_id, "s1");
    assert.equal(rows[0].source, "chat");
    assert.equal(rows[0].input_tokens, 1000);
    assert.equal(rows[0].output_tokens, 500);
    assert.ok(rows[0].cost_usd > 0);
    assert.ok(rows[0].fx_usd_eur > 0);
    assert.equal(rows[0].cost_eur, undefined); // ya no existe esta columna — se deriva al leer, nunca se guarda
  });

  test("sin tenantId -> no inserta nada (no hay a quién atribuir el gasto)", async () => {
    const admin = makeFakeSupabaseAdmin();
    await recordTokenUsage({
      admin, tenantId: null, source: "chat", model: "claude-sonnet-4-6",
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    assert.equal((admin._state.tables.ai_token_usage || []).length, 0);
  });

  test("sin usage (rama de error de la llamada a Claude) -> no inserta nada", async () => {
    const admin = makeFakeSupabaseAdmin();
    await recordTokenUsage({ admin, tenantId: "t1", source: "chat", model: "claude-sonnet-4-6", usage: null });
    assert.equal((admin._state.tables.ai_token_usage || []).length, 0);
  });

  test("session_id es opcional -> queda null (p.ej. chat sin sesión activa)", async () => {
    const admin = makeFakeSupabaseAdmin();
    await recordTokenUsage({
      admin, tenantId: "t1", source: "chat", model: "claude-sonnet-4-6",
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    assert.equal(admin._state.tables.ai_token_usage[0].session_id, null);
  });

  test("modelo sin precio conocido -> igual inserta tokens, cost_usd queda null (nunca bloquea la captura), fx sí se guarda", async () => {
    const admin = makeFakeSupabaseAdmin();
    await recordTokenUsage({
      admin, tenantId: "t1", source: "guide_detect", model: "claude-modelo-futuro",
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    const row = admin._state.tables.ai_token_usage[0];
    assert.equal(row.input_tokens, 100);
    assert.equal(row.cost_usd, null);
    assert.ok(row.fx_usd_eur > 0);
  });

  test("tokens de caché se guardan en sus propias columnas, no mezclados con input_tokens", async () => {
    const admin = makeFakeSupabaseAdmin();
    await recordTokenUsage({
      admin, tenantId: "t1", source: "guide_steps", model: "claude-opus-4-8",
      usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 2000, cache_read_input_tokens: 8000 },
    });
    const row = admin._state.tables.ai_token_usage[0];
    assert.equal(row.input_tokens, 100);
    assert.equal(row.cache_creation_input_tokens, 2000);
    assert.equal(row.cache_read_input_tokens, 8000);
  });

  test("el insert falla (error devuelto, no excepción) -> no lanza, se resuelve igual", async () => {
    const admin = {
      from: () => ({ insert: async () => ({ error: { message: "relation does not exist", code: "42P01" } }) }),
    };
    await assert.doesNotReject(recordTokenUsage({
      admin, tenantId: "t1", source: "chat", model: "claude-sonnet-4-6",
      usage: { input_tokens: 10, output_tokens: 5 },
    }));
  });

  test("el cliente admin lanza una excepción (p.ej. red caída) -> tampoco se propaga", async () => {
    const admin = { from: () => { throw new Error("network down"); } };
    await assert.doesNotReject(recordTokenUsage({
      admin, tenantId: "t1", source: "chat", model: "claude-sonnet-4-6",
      usage: { input_tokens: 10, output_tokens: 5 },
    }));
  });
}
