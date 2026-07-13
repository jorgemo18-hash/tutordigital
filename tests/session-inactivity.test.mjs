import assert from "node:assert/strict";
import { makeFakeSupabaseAdmin } from "./support/fakeSupabaseAdmin.mjs";
import { closeSessionIfInactive } from "../server/lib/orchestrator/sessionInactivity.js";

// Cierre por inactividad vía evaluación perezosa (sin cron — Render en plan
// gratuito): tutor_sessions no tiene columna de última actividad, solo
// created_at, así que la señal real es el último session_messages.created_at
// (o created_at de la sesión si nunca hubo mensajes).
const MIN = 60 * 1000;
const ago = (minutes) => new Date(Date.now() - minutes * MIN).toISOString();

export async function run({ test }) {
  function seed({ sessions = [], messages = [] } = {}) {
    return { tutor_sessions: sessions, session_messages: messages };
  }

  test("in_progress + último mensaje hace >45min -> se cierra a abandoned", async () => {
    const admin = makeFakeSupabaseAdmin(seed({
      sessions: [{ id: "s1", outcome: "in_progress", created_at: ago(200), needs_help: false, escalation_reason: null }],
      messages: [{ id: "m1", session_id: "s1", created_at: ago(50) }],
    }));
    const result = await closeSessionIfInactive(admin, "s1");
    assert.deepEqual(result, { closed: true, outcome: "abandoned" });
    const row = admin._state.tables.tutor_sessions.find((s) => s.id === "s1");
    assert.equal(row.outcome, "abandoned");
  });

  test("in_progress + último mensaje hace <45min -> sigue in_progress", async () => {
    const admin = makeFakeSupabaseAdmin(seed({
      sessions: [{ id: "s2", outcome: "in_progress", created_at: ago(200) }],
      messages: [{ id: "m1", session_id: "s2", created_at: ago(10) }],
    }));
    const result = await closeSessionIfInactive(admin, "s2");
    assert.deepEqual(result, { closed: false, outcome: "in_progress" });
    const row = admin._state.tables.tutor_sessions.find((s) => s.id === "s2");
    assert.equal(row.outcome, "in_progress");
  });

  test("sin mensajes, created_at hace >45min -> se cierra usando created_at como referencia", async () => {
    const admin = makeFakeSupabaseAdmin(seed({
      sessions: [{ id: "s3", outcome: "in_progress", created_at: ago(46) }],
      messages: [],
    }));
    const result = await closeSessionIfInactive(admin, "s3");
    assert.deepEqual(result, { closed: true, outcome: "abandoned" });
  });

  test("sin mensajes, created_at hace <45min (sesión recién creada) -> no se toca", async () => {
    const admin = makeFakeSupabaseAdmin(seed({
      sessions: [{ id: "s4", outcome: "in_progress", created_at: ago(5) }],
      messages: [],
    }));
    const result = await closeSessionIfInactive(admin, "s4");
    assert.deepEqual(result, { closed: false, outcome: "in_progress" });
  });

  test("outcome null (nunca fijado) se trata igual que in_progress", async () => {
    const admin = makeFakeSupabaseAdmin(seed({
      sessions: [{ id: "s5", outcome: null, created_at: ago(100) }],
      messages: [],
    }));
    const result = await closeSessionIfInactive(admin, "s5");
    assert.deepEqual(result, { closed: true, outcome: "abandoned" });
  });

  test("sesión ya completed/escalated -> nunca se toca aunque lleve horas inactiva", async () => {
    const admin = makeFakeSupabaseAdmin(seed({
      sessions: [
        { id: "s6", outcome: "completed", created_at: ago(500) },
        { id: "s7", outcome: "escalated", created_at: ago(500) },
      ],
      messages: [],
    }));
    const r6 = await closeSessionIfInactive(admin, "s6");
    const r7 = await closeSessionIfInactive(admin, "s7");
    assert.deepEqual(r6, { closed: false, outcome: "completed" });
    assert.deepEqual(r7, { closed: false, outcome: "escalated" });
  });

  test("needs_help y escalation_reason no se tocan al cerrar por inactividad", async () => {
    const admin = makeFakeSupabaseAdmin(seed({
      sessions: [{ id: "s8", outcome: "in_progress", created_at: ago(200), needs_help: true, escalation_reason: "motivo original" }],
      messages: [{ id: "m1", session_id: "s8", created_at: ago(50) }],
    }));
    await closeSessionIfInactive(admin, "s8");
    const row = admin._state.tables.tutor_sessions.find((s) => s.id === "s8");
    assert.equal(row.outcome, "abandoned");
    assert.equal(row.needs_help, true);
    assert.equal(row.escalation_reason, "motivo original");
  });

  test("sesión inexistente -> no revienta, closed:false, outcome:null", async () => {
    const admin = makeFakeSupabaseAdmin(seed());
    const result = await closeSessionIfInactive(admin, "does-not-exist");
    assert.deepEqual(result, { closed: false, outcome: null });
  });

  test("varios mensajes -> usa el más reciente (order by created_at desc), no el primero de la lista", async () => {
    const admin = makeFakeSupabaseAdmin(seed({
      sessions: [{ id: "s9", outcome: "in_progress", created_at: ago(300) }],
      messages: [
        { id: "m1", session_id: "s9", created_at: ago(200) },
        { id: "m2", session_id: "s9", created_at: ago(10) }, // el más reciente: dentro de la ventana
        { id: "m3", session_id: "s9", created_at: ago(150) },
      ],
    }));
    const result = await closeSessionIfInactive(admin, "s9");
    assert.deepEqual(result, { closed: false, outcome: "in_progress" });
  });
}
