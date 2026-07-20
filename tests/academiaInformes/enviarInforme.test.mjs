import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// Prueba de extremo a extremo (con fake de Supabase + fetch mockeado, sin
// red real ni llamada a Claude) de que PDF y email de recibo leen del
// MISMO sitio: academia_textos_legales. Se fuerza el camino "sin
// actividad" (sin sesiones ese mes) para no depender de la IA — el texto
// de exención/LOPD no depende de esa rama, así que sigue siendo una
// prueba válida de la consolidación.
function fetchMockCapturandoPayload(bodyCapturado) {
  return async (url, opts) => {
    bodyCapturado.url = url;
    bodyCapturado.body = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ ok: true }) };
  };
}

export async function run({ test, assert }) {
  const { enviarInformePorAlumno } = await import("../../server/lib/academiaInformes/enviarInforme.js");

  const TENANT_ID = "t1";
  const ALUMNO_ID = "a1";
  const FAMILIA = { id: "f1", nombre: "Familia García", email: "familia@example.com", dni: "", direccion: "", ciudad: "", codigo_postal: "", metodo_pago: "transferencia" };

  function fakeAdminBase() {
    return makeFakeSupabaseAdmin({
      academia_alumnos: [{ id: ALUMNO_ID, tenant_id: TENANT_ID, nombre: "Ana García", curso: "1º ESO", familia_id: "f1", familia: FAMILIA }],
      academia_sesiones: [],
      academia_festivos: [],
      academia_informes: [],
      academia_recibos: [],
      academia_recibos_lineas: [],
      academia_config: [{ tenant_id: TENANT_ID, nombre_emisor: "Academia Lyceo", email_emisor: "info@lyceoacademia.es" }],
      academia_textos_legales: [
        { id: "tl1", tenant_id: TENANT_ID, tipo: "recibos", contenido: "Operación exenta de IVA según Art. 20.Uno.9º.", activo: true },
        { id: "tl2", tenant_id: TENANT_ID, tipo: "email", contenido: "Texto LOPD de Marca y textos.", activo: true },
      ],
    });
  }

  const originalFetch = globalThis.fetch;

  test("el payload que recibe el microservicio trae el mismo texto de exención/LOPD que academia_textos_legales", async () => {
    const admin = fakeAdminBase();
    const capturado = {};
    globalThis.fetch = fetchMockCapturandoPayload(capturado);
    try {
      const resultado = await enviarInformePorAlumno(admin, {
        tenantId: TENANT_ID, tenantNombre: "Lyceo", alumnoId: ALUMNO_ID, mes: 6, anio: 2026,
        apiKey: "no-se-usa-sin-sesiones", pdfServiceUrl: "http://pdf-service.test",
      });
      assert.equal(resultado.ok, true, resultado.motivo);
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(capturado.url, "http://pdf-service.test/informe");
    assert.equal(capturado.body.academia.texto_exencion, "Operación exenta de IVA según Art. 20.Uno.9º.");
    assert.equal(capturado.body.academia.lopd_footer, "Texto LOPD de Marca y textos.");
    // Nunca debe viajar como campo aparte del sistema viejo.
    assert.equal(capturado.body.academia.texto_exencion_iva, undefined);
  });

  test("editar el texto en Marca y textos (academia_textos_legales) cambia lo que recibe el microservicio, sin tocar nada más", async () => {
    const admin = fakeAdminBase();
    admin._state.tables.academia_textos_legales[0].contenido = "Texto de exención YA EDITADO.";

    const capturado = {};
    globalThis.fetch = fetchMockCapturandoPayload(capturado);
    try {
      await enviarInformePorAlumno(admin, {
        tenantId: TENANT_ID, tenantNombre: "Lyceo", alumnoId: ALUMNO_ID, mes: 6, anio: 2026,
        apiKey: "no-se-usa-sin-sesiones", pdfServiceUrl: "http://pdf-service.test",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(capturado.body.academia.texto_exencion, "Texto de exención YA EDITADO.");
  });

  test("un texto 'recibos' inactivo (desactivado en Marca y textos) no viaja al microservicio", async () => {
    const admin = fakeAdminBase();
    admin._state.tables.academia_textos_legales[0].activo = false;

    const capturado = {};
    globalThis.fetch = fetchMockCapturandoPayload(capturado);
    try {
      await enviarInformePorAlumno(admin, {
        tenantId: TENANT_ID, tenantNombre: "Lyceo", alumnoId: ALUMNO_ID, mes: 6, anio: 2026,
        apiKey: "no-se-usa-sin-sesiones", pdfServiceUrl: "http://pdf-service.test",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(capturado.body.academia.texto_exencion, undefined);
    // El LOPD (tipo distinto) no se ve afectado por desactivar el de recibos.
    assert.equal(capturado.body.academia.lopd_footer, "Texto LOPD de Marca y textos.");
  });

  test("academia_config.texto_exencion_iva presente pero ignorado — la fuente real es solo academia_textos_legales", async () => {
    const admin = fakeAdminBase();
    admin._state.tables.academia_config[0].texto_exencion_iva = "Texto del sistema viejo — no debe llegar al microservicio.";

    const capturado = {};
    globalThis.fetch = fetchMockCapturandoPayload(capturado);
    try {
      await enviarInformePorAlumno(admin, {
        tenantId: TENANT_ID, tenantNombre: "Lyceo", alumnoId: ALUMNO_ID, mes: 6, anio: 2026,
        apiKey: "no-se-usa-sin-sesiones", pdfServiceUrl: "http://pdf-service.test",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(capturado.body.academia.texto_exencion, "Operación exenta de IVA según Art. 20.Uno.9º.");
  });
}
