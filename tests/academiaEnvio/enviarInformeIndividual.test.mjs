import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

const TENANT_ID = "t1";
const ALUMNO_ID = "a1";

// Fixture sin sesiones/festivos ese mes -> generarYGuardarComentario toma
// el camino barato "Sin actividad..." (sin llamar a Claude), igual truco
// que enviarInforme.test.mjs usaba antes de que ese archivo se retirase.
function fixture({ enviadoAtPrevio = null } = {}) {
  return makeFakeSupabaseAdmin({
    academia_alumnos: [{
      id: ALUMNO_ID, tenant_id: TENANT_ID, nombre: "Ana García", curso: "1º ESO", familia_id: "f1",
      familia: { id: "f1", nombre: "Familia García", email: "familia@example.com" },
    }],
    academia_sesiones: [],
    academia_festivos: [],
    academia_informes: enviadoAtPrevio !== undefined && enviadoAtPrevio !== null
      ? [{ id: "inf1", tenant_id: TENANT_ID, alumno_id: ALUMNO_ID, mes: 7, anio: 2026, comentario: "Comentario viejo", enviado_at: enviadoAtPrevio }]
      : [],
    academia_config: [{ tenant_id: TENANT_ID, nombre_emisor: "Academia Lyceo", email_texto_solo_informe: "Hola {familia}, el informe de {mes}." }],
    academia_textos_legales: [{ tenant_id: TENANT_ID, tipo: "email", contenido: "Texto LOPD.", activo: true }],
  });
}

function fakesOk() {
  const llamadas = { informe: [], email: [] };
  return {
    llamadas,
    generarInformePdfFn: async (args) => { llamadas.informe.push(args); return { ok: true, buffer: Buffer.from("PDF-INFORME") }; },
    enviarEmailFn: async (args) => { llamadas.email.push(args); },
  };
}

export async function run({ test, assert }) {
  const { enviarInformeDeAlumno } = await import("../../server/lib/academiaEnvio/enviarInformeIndividual.js");

  test("informe nunca enviado -> genera el PDF, envía el email y marca enviado_at", async () => {
    const admin = fixture();
    const fakes = fakesOk();
    const resultado = await enviarInformeDeAlumno(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", alumnoId: ALUMNO_ID, mes: 7, anio: 2026,
      apiKey: "no-se-usa-sin-sesiones", pdfServiceUrl: "http://pdf.test", ...fakes,
    });

    assert.equal(resultado.ok, true, resultado.motivo);
    assert.equal(fakes.llamadas.informe.length, 1);
    assert.equal(fakes.llamadas.email.length, 1);
    assert.equal(fakes.llamadas.email[0].attachments.length, 1);
    assert.equal(fakes.llamadas.email[0].to, "familia@example.com");

    const informe = admin._state.tables.academia_informes.find((i) => i.alumno_id === ALUMNO_ID);
    assert.ok(informe.enviado_at);
  });

  test("usa email_texto_solo_informe (no el de completo) — es un envío 'solo informe'", async () => {
    const admin = fixture();
    const fakes = fakesOk();
    await enviarInformeDeAlumno(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", alumnoId: ALUMNO_ID, mes: 7, anio: 2026,
      apiKey: "no-se-usa-sin-sesiones", pdfServiceUrl: "http://pdf.test", ...fakes,
    });
    assert.equal(fakes.llamadas.email[0].html.includes("Hola Familia García, el informe de julio."), true);
  });

  test("ya enviado + sin confirmar -> requiere_confirmacion, no genera PDF ni envía nada", async () => {
    const admin = fixture({ enviadoAtPrevio: "2026-07-01T10:00:00.000Z" });
    const fakes = fakesOk();
    const resultado = await enviarInformeDeAlumno(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", alumnoId: ALUMNO_ID, mes: 7, anio: 2026,
      apiKey: "no-se-usa-sin-sesiones", pdfServiceUrl: "http://pdf.test", confirmar: false, ...fakes,
    });

    assert.equal(resultado.ok, false);
    assert.equal(resultado.code, "requiere_confirmacion");
    assert.equal(resultado.enviado_at, "2026-07-01T10:00:00.000Z");
    assert.equal(fakes.llamadas.informe.length, 0);
    assert.equal(fakes.llamadas.email.length, 0);
  });

  test("ya enviado + confirmar:true -> reenvía y actualiza enviado_at", async () => {
    const admin = fixture({ enviadoAtPrevio: "2026-07-01T10:00:00.000Z" });
    const fakes = fakesOk();
    const resultado = await enviarInformeDeAlumno(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", alumnoId: ALUMNO_ID, mes: 7, anio: 2026,
      apiKey: "no-se-usa-sin-sesiones", pdfServiceUrl: "http://pdf.test", confirmar: true, ...fakes,
    });

    assert.equal(resultado.ok, true, resultado.motivo);
    assert.equal(fakes.llamadas.email.length, 1);
  });

  test("el único PDF falla -> no envía nada, error pdf_failed", async () => {
    const admin = fixture();
    const fakes = fakesOk();
    fakes.generarInformePdfFn = async () => ({ ok: false, code: "pdf_service_failed", motivo: "cold start" });

    const resultado = await enviarInformeDeAlumno(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", alumnoId: ALUMNO_ID, mes: 7, anio: 2026,
      apiKey: "no-se-usa-sin-sesiones", pdfServiceUrl: "http://pdf.test", ...fakes,
    });

    assert.equal(resultado.ok, false);
    assert.equal(resultado.code, "pdf_failed");
    assert.equal(fakes.llamadas.email.length, 0);
  });
}
