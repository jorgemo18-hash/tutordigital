// Integración real contra tutordigital-pdf-service (red de verdad, sin
// mocks) — condicional a PDF_SERVICE_URL: en `npm test` normal (sin esa
// variable en el entorno) se salta en silencio, así que no ralentiza ni
// rompe la suite de nadie. Para ejecutarla de verdad:
//   PDF_SERVICE_URL=https://tutordigital-pdf-service.onrender.com npm test
//   (o TEST="Familia García" con el mismo prefijo, para no correr toda la suite)
//
// Reproduce el caso exacto que rompió en producción (TUTORDIGITAL-BACKEND-B/C,
// 2026-07-22): "Familia García" de Lyceo, 2 hermanos con descuento
// "Hermanos" recurrente, descuento puntual de familia con nota, y texto de
// exención de IVA — datos reales tomados de Supabase (solo lectura) el
// mismo día del incidente. Los unitarios existentes (enviarFamiliaEmail.test.mjs)
// nunca lo cazaron porque fakean generarReciboPdfFn/generarInformePdfFn —
// nunca llaman al microservicio real, así que no pueden ver un fallo que
// solo ocurre ahí.
import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

const TENANT_ID = "88da1d9d-6dd3-496f-92a3-42d1597a70ff";
const FAMILIA_ID = "2d2180c2-add2-443f-8959-f44b29678664";
const ANIBAL_ID = "a400c40e-99fc-455c-a259-a2c7356793a2";
const JOSE_ID = "c66c34cb-20df-4236-b7ea-f410597c002c";

function fixtureFamiliaGarcia() {
  return makeFakeSupabaseAdmin({
    academia_familias: [{
      id: FAMILIA_ID, tenant_id: TENANT_ID, nombre: "Familia García",
      // No se envía ningún email de verdad: enviarEmailFn es un fake más abajo.
      email: "integracion-test@example.invalid",
      dni: null, direccion: null, codigo_postal: null, ciudad: null, metodo_pago: "bizum",
    }],
    academia_alumnos: [
      { id: JOSE_ID, tenant_id: TENANT_ID, familia_id: FAMILIA_ID, nombre: "jose matias", curso: "2º ESO", activo: true },
      { id: ANIBAL_ID, tenant_id: TENANT_ID, familia_id: FAMILIA_ID, nombre: "ANIBAL_1E", curso: "1º ESO", activo: true },
    ],
    academia_config: [{
      tenant_id: TENANT_ID, nombre_emisor: "Academia Lyceo", dni_emisor: "18042793Y",
      direccion_emisor: "Jazmín 1 bajos", ciudad_emisor: null, cp_emisor: null,
      telefono_emisor: "675324128", email_emisor: "info@lyceoacademia.es",
      logo_url: "https://jzheomyuwztdhttejskz.supabase.co/storage/v1/object/public/academia-assets/88da1d9d-6dd3-496f-92a3-42d1597a70ff/logo.png?v=1783980285735",
      email_texto_completo: "Hola {familia}, os adjuntamos el recibo de {mes} ({total}) y el informe del trabajo realizado este mes.",
    }],
    academia_textos_legales: [
      { tenant_id: TENANT_ID, tipo: "email", contenido: "Texto LOPD de Lyceo.", activo: true },
      { tenant_id: TENANT_ID, tipo: "recibos", contenido: "Operación exenta de IVA según Art. 20.Uno.9º de la Ley 37/1992", activo: true },
    ],
    academia_recibos: [{
      id: "e18646fd-d781-4d53-92b9-f1027d8250c7", tenant_id: TENANT_ID, familia_id: FAMILIA_ID, mes: 7, anio: 2026,
      concepto: "clases académia", numero_recibo: "REC-2026-008", created_at: "2026-07-21T08:07:28.820Z",
      total_bruto: 120, total_descuento: 64.8, total_neto: 55.2,
      descuento_puntual_pct: 39, descuento_puntual_nota: "por que si", descuento_hermanos_pct: 0,
      estado: "enviado", fecha_envio: "2026-07-22T11:13:36.608Z",
      familia: { id: FAMILIA_ID, nombre: "Familia García", email: "integracion-test@example.invalid" },
    }],
    academia_recibos_lineas: [
      {
        id: "l1", recibo_id: "e18646fd-d781-4d53-92b9-f1027d8250c7", alumno_id: JOSE_ID,
        nombre_alumno: "jose matias", curso_alumno: "2º ESO", precio_bruto: 45,
        descripcion: "clases académia", descuentos_recurrentes: [{ concepto: "Hermanos", porcentaje: 15, importe: 6.75 }],
      },
      {
        id: "l2", recibo_id: "e18646fd-d781-4d53-92b9-f1027d8250c7", alumno_id: ANIBAL_ID,
        nombre_alumno: "ANIBAL_1E", curso_alumno: "1º ESO", precio_bruto: 75,
        descripcion: "clases académia", descuentos_recurrentes: [{ concepto: "Hermanos", porcentaje: 15, importe: 11.25 }],
      },
    ],
    academia_informes: [
      { id: "inf1", tenant_id: TENANT_ID, alumno_id: ANIBAL_ID, mes: 7, anio: 2026, comentario: "Este mes hemos trabajado las fracciones en Matemáticas y la verdad es que se ha notado una actitud muy positiva.", enviado_at: "2026-07-22T11:13:36.764Z" },
      { id: "inf2", tenant_id: TENANT_ID, alumno_id: JOSE_ID, mes: 7, anio: 2026, comentario: "Sin actividad registrada este mes.", enviado_at: "2026-07-22T11:13:36.699Z" },
    ],
    academia_sesiones: [],
    academia_festivos: [],
  });
}

export async function run({ test, assert }) {
  const pdfServiceUrl = process.env.PDF_SERVICE_URL;

  test("(conditional, requiere PDF_SERVICE_URL) enviar tipo=completo a Familia García real -> 200, recibo + 2 informes como PDF válidos", async () => {
    if (!pdfServiceUrl) return;

    const { enviarReciboYInformesDeFamilia } = await import("../../server/lib/academiaEnvio/enviarFamiliaEmail.js");
    const admin = fixtureFamiliaGarcia();
    const emails = [];

    const resultado = await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Academia Lyceo", familiaId: FAMILIA_ID,
      mes: 7, anio: 2026, pdfServiceUrl, tipoEnvio: "completo", confirmar: true,
      enviarEmailFn: async (args) => { emails.push(args); },
    });

    assert.equal(resultado.ok, true, resultado.motivo);
    assert.equal(resultado.reciboAdjuntado, true);
    assert.equal(resultado.informesAdjuntados, 2);
    assert.equal(emails.length, 1);
    assert.equal(emails[0].attachments.length, 3, "recibo + 2 informes");
    for (const adjunto of emails[0].attachments) {
      const cabecera = adjunto.content.subarray(0, 4).toString("latin1");
      assert.equal(cabecera, "%PDF", `${adjunto.filename} no es un PDF válido (cabecera: ${cabecera})`);
    }
  });
}
