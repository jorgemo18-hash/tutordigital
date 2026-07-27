// buildTokenStats/buildSessionBreakdown (superadmin.stats.routes.js):
// distinguen "sin datos todavía" (null) de "consumo real cero" (0) y
// derivan EUR de cost_usd*fx_usd_eur por fila (nunca del fx de hoy) — la
// parte con lógica real de la ruta, separada de Fastify/Supabase para
// poder testearla directo.
export async function run({ test, assert }) {
  const { buildTokenStats, buildSessionBreakdown } = await import("../../server/routes/v1/superadmin.stats.routes.js");

  const PERIOD_START_ISO = "2026-07-01T00:00:00.000Z";

  test("sin ninguna fila jamás en ai_token_usage -> todo null, no 0 disfrazado de consumo real", () => {
    const stats = buildTokenStats({ trackingDesde: null, periodStartISO: PERIOD_START_ISO, tokenUsageRows: [] });
    assert.equal(stats.tokens_mes, null);
    assert.equal(stats.tokens_input_mes, null);
    assert.equal(stats.tokens_output_mes, null);
    assert.equal(stats.coste_ia_mes, null);
    assert.equal(stats.coste_ia_mes_usd, null);
    assert.equal(stats.tokens_tracking_desde, null);
    assert.equal(stats.tokens_periodo_parcial, false);
  });

  test("tracking activo desde antes de este periodo, sin filas -> 0 real, no null", () => {
    const stats = buildTokenStats({
      trackingDesde: "2026-05-10T08:00:00.000Z", // antes del periodo reportado
      periodStartISO: PERIOD_START_ISO,
      tokenUsageRows: [],
    });
    assert.equal(stats.tokens_mes, 0);
    assert.equal(stats.coste_ia_mes, 0);
    assert.equal(stats.coste_ia_mes_usd, 0);
    assert.equal(stats.tokens_periodo_parcial, false);
  });

  test("tracking empezó a mitad de este periodo -> números reales pero marcados como parcial", () => {
    const stats = buildTokenStats({
      trackingDesde: "2026-07-15T10:00:00.000Z",
      periodStartISO: PERIOD_START_ISO,
      tokenUsageRows: [{ input_tokens: 1000, output_tokens: 500, cost_usd: 0.02, fx_usd_eur: 0.9 }],
    });
    assert.equal(stats.tokens_mes, 1500);
    assert.equal(stats.tokens_periodo_parcial, true);
  });

  test("periodStartISO null ('all', sin límite inferior) -> nunca es parcial", () => {
    const stats = buildTokenStats({
      trackingDesde: "2026-07-15T10:00:00.000Z",
      periodStartISO: null,
      tokenUsageRows: [{ input_tokens: 100, output_tokens: 50, cost_usd: 0.001, fx_usd_eur: 0.9 }],
    });
    assert.equal(stats.tokens_periodo_parcial, false);
  });

  test("EUR se deriva por fila (cost_usd * fx_usd_eur de ESA fila), nunca con un fx único aplicado al total", () => {
    const stats = buildTokenStats({
      trackingDesde: "2026-01-01T00:00:00.000Z",
      periodStartISO: PERIOD_START_ISO,
      tokenUsageRows: [
        { input_tokens: 1000, output_tokens: 0, cost_usd: 1, fx_usd_eur: 0.8 },  // 0.8 EUR
        { input_tokens: 1000, output_tokens: 0, cost_usd: 1, fx_usd_eur: 0.9 },  // 0.9 EUR (fx distinto, congelado en su momento)
      ],
    });
    assert.equal(stats.coste_ia_mes_usd, 2); // USD exacto: suma directa, sin conversión de por medio
    assert.ok(Math.abs(stats.coste_ia_mes - 1.7) < 1e-9); // EUR: 0.8 + 0.9, no 2 * un fx cualquiera
  });

  test("una fila con cost_usd null (modelo sin precio) no bloquea el coste de las demás", () => {
    const stats = buildTokenStats({
      trackingDesde: "2026-01-01T00:00:00.000Z",
      periodStartISO: PERIOD_START_ISO,
      tokenUsageRows: [
        { input_tokens: 1000, output_tokens: 200, cost_usd: 0.01, fx_usd_eur: 0.9 },
        { input_tokens: 500,  output_tokens: 100, cost_usd: null, fx_usd_eur: 0.9 }, // modelo sin precio en ese momento
      ],
    });
    assert.equal(stats.tokens_mes, 1800); // los tokens sí se cuentan todos
    assert.ok(stats.coste_ia_mes_usd > 0 && stats.coste_ia_mes_usd < 0.02); // el coste solo suma lo conocido
  });

  test("todas las filas sin cost_usd conocido -> coste_ia_mes/usd null, no 0", () => {
    const stats = buildTokenStats({
      trackingDesde: "2026-01-01T00:00:00.000Z",
      periodStartISO: PERIOD_START_ISO,
      tokenUsageRows: [{ input_tokens: 500, output_tokens: 100, cost_usd: null, fx_usd_eur: 0.9 }],
    });
    assert.equal(stats.tokens_mes, 600); // tokens reales, sí se muestran
    assert.equal(stats.coste_ia_mes, null);
    assert.equal(stats.coste_ia_mes_usd, null);
  });

  // ── buildSessionBreakdown ────────────────────────────────────────────────

  test("buildSessionBreakdown: cuenta alumnos únicos por student_id, sin duplicar", () => {
    const rows = [
      { student_id: "a1", task_id: "t1", session_date: "2026-07-10" },
      { student_id: "a1", task_id: "t2", session_date: "2026-07-11" }, // mismo alumno, otra sesión
      { student_id: "a2", task_id: "t1", session_date: "2026-07-11" },
    ];
    const { uniqueStudents } = buildSessionBreakdown(rows, new Map(), false);
    assert.equal(uniqueStudents, 2);
  });

  test("buildSessionBreakdown: modes cuenta por tasks.type, incluida sesion_libre en su propia clave (nunca agrupada en otros)", () => {
    const rows = [
      { student_id: "a1", task_id: "t1", session_date: "2026-07-10" },
      { student_id: "a2", task_id: "t2", session_date: "2026-07-10" },
      { student_id: "a3", task_id: "t3", session_date: "2026-07-10" },
      { student_id: "a4", task_id: "t4", session_date: "2026-07-10" },
    ];
    const taskTypeById = new Map([["t1", "homework"], ["t2", "exam"], ["t3", "work"], ["t4", "sesion_libre"]]);
    const { modes } = buildSessionBreakdown(rows, taskTypeById, false);
    assert.equal(modes.DEBERES, 1);
    assert.equal(modes.EXAMEN, 1);
    assert.equal(modes.TRABAJO, 1);
    assert.equal(modes.SESION_LIBRE, 1);
  });

  test("buildSessionBreakdown: includeDaily=false (year/all) -> sessionsByDay null, sin intentar un histograma sin acotar", () => {
    const rows = [{ student_id: "a1", task_id: "t1", session_date: "2026-07-10" }];
    const { sessionsByDay } = buildSessionBreakdown(rows, new Map(), false);
    assert.equal(sessionsByDay, null);
  });

  test("buildSessionBreakdown: includeDaily=true (7d/month) -> agrupa por día, ordenado", () => {
    const rows = [
      { student_id: "a1", task_id: "t1", session_date: "2026-07-11" },
      { student_id: "a2", task_id: "t1", session_date: "2026-07-10" },
      { student_id: "a3", task_id: "t1", session_date: "2026-07-10" },
    ];
    const { sessionsByDay } = buildSessionBreakdown(rows, new Map(), true);
    assert.deepEqual(sessionsByDay, [
      { date: "2026-07-10", count: 2 },
      { date: "2026-07-11", count: 1 },
    ]);
  });

  test("buildSessionBreakdown: sin filas -> 0 alumnos únicos, todos los modos en 0, no revienta", () => {
    const { uniqueStudents, modes, sessionsByDay } = buildSessionBreakdown([], new Map(), true);
    assert.equal(uniqueStudents, 0);
    assert.deepEqual(modes, { DEBERES: 0, EXAMEN: 0, TRABAJO: 0, SESION_LIBRE: 0 });
    assert.deepEqual(sessionsByDay, []);
  });
}
