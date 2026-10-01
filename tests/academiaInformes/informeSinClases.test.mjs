import { Window } from "happy-dom";
import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

if (!globalThis.document) globalThis.document = new Window().document;

// EL MES DEL INFORME SIN CLASES NO ES UN ERROR (Jorge, 1/10/2026): con el
// envío «recibo del mes que empieza + informe del que acaba», el envío de
// septiembre lleva el informe de agosto; sin clases en agosto, generar los
// informes acababa en «no se pueden generar: no hay sesiones», alumno por
// alumno. Ahora: no hay informe que hacer, se dice, y la cabecera lleva al
// envío donde está el informe que se buscaba.
export async function run({ test, assert }) {
  const { generarYGuardarComentario } = await import("../../server/lib/academiaInformes/generarInforme.js");
  const { regenerarLote } = await import("../../assets/academia/admin/js/sections/envioFamilias/acciones/accionesLote.js");
  const { textoOkLote, buildAtajoAlInforme } = await import("../../assets/academia/admin/js/sections/envioFamilias/cabecera.js");
  const { hayClases } = await import("../../assets/academia/admin/js/sections/envioFamilias/informeCard.js");

  const T = "t1";
  const A = "a1";
  // Agosto: una ausencia y un festivo, ninguna clase. La tabla de informes
  // apunta cada upsert para ver que NO se guarda nada.
  function fakeAdmin() {
    const upserts = [];
    const base = makeFakeSupabaseAdmin({
      academia_alumnos: [{ id: A, tenant_id: T, nombre: "Ana", curso: "1º ESO", familia_id: "f1", familia: { email: "f@example.com" } }],
      academia_sesiones: [{ tenant_id: T, alumno_id: A, fecha: "2026-08-04", tipo: "ausencia" }],
      academia_festivos: [{ tenant_id: T, fecha: "2026-08-15", descripcion: "Asunción" }],
    });
    const informes = {
      select: () => {
        const q = { eq: () => q, maybeSingle: () => Promise.resolve({ data: null, error: null }) };
        return q;
      },
      upsert: (payload) => { upserts.push(payload); return { select: () => ({ single: () => Promise.resolve({ data: { id: "i", enviado_at: null }, error: null }) }) }; },
    };
    return { upserts, from: (t) => (t === "academia_informes" ? informes : base.from(t)) };
  }

  test("sin clases (solo ausencias y festivos): ok, sinClases, sin guardar nada y sin llamar a la IA", async () => {
    const admin = fakeAdmin();
    const r = await generarYGuardarComentario(admin, { tenantId: T, alumnoId: A, mes: 8, anio: 2026, apiKey: "" });
    assert.equal(r.ok, true, r.motivo);
    assert.equal(r.sinClases, true);
    assert.equal(r.comentario, null);
    assert.equal(r.dias.length, 2, "la tabla de días sigue saliendo");
    assert.equal(admin.upserts.length, 0, "no se guarda un informe vacío que luego se mandaría");
  });

  test("el lote cuenta los «sin clases» aparte, no como errores, y el botón lo dice con el mes del informe", async () => {
    const r = await regenerarLote("solo_informe", {
      mes: 9, anio: 2026, periodoInforme: { mes: 8, anio: 2026 },
      regenerarInformesFn: async () => ({ regenerados: 0, fallidos: 0, sin_clases: 12 }),
      confirmFn: async () => true,
    });
    assert.equal(r.fallidos, 0);
    assert.equal(r.sinClases, 12);
    assert.equal(textoOkLote("✓ Regenerado")(r), "✓ Regenerado (12 sin clases en agosto)");
    assert.equal(textoOkLote("✓ Regenerado")({ fallidos: 2, sinClases: 0 }), "✓ Regenerado (2 errores)");
  });

  test("la cabecera lleva al envío del mes siguiente cuando el informe no tuvo clases, y solo entonces", () => {
    const cambios = [];
    const onCambiarPeriodo = (p) => cambios.push(p);
    const atajo = buildAtajoAlInforme({ mes: 9, anio: 2026, periodoInforme: { mes: 8, anio: 2026 }, informeSinClases: true, onCambiarPeriodo });
    assert.match(atajo.textContent, /En agosto no hubo clases.*Los de septiembre van en el envío de octubre/);
    atajo.click();
    assert.deepEqual(cambios, [{ mes: 10, anio: 2026 }]);
    // Booleanos, no el nodo: al fallar, assert serializa el nodo de happy-dom
    // entero y el proceso se queda sin memoria.
    assert.equal(buildAtajoAlInforme({ mes: 10, anio: 2026, periodoInforme: { mes: 9, anio: 2026 }, informeSinClases: false, onCambiarPeriodo }) === null, true, "con clases, ruido");
    assert.equal(buildAtajoAlInforme({ mes: 9, anio: 2026, periodoInforme: { mes: 9, anio: 2026 }, informeSinClases: true, onCambiarPeriodo }) === null, true, "modo mismo mes: no hay otro envío al que ir");
    const dic = buildAtajoAlInforme({ mes: 12, anio: 2026, periodoInforme: { mes: 11, anio: 2026 }, informeSinClases: true, onCambiarPeriodo });
    dic.click();
    assert.deepEqual(cambios[1], { mes: 1, anio: 2027 }, "de diciembre a enero del año siguiente");
  });

  test("la card del informe: sin ningún día de clase no ofrece «Generar informe»", () => {
    assert.equal(hayClases([{ dia: 4, ausencia: true }, { dia: 15, festivo: "Asunción" }]), false);
    assert.equal(hayClases([{ dia: 4, ausencia: true }, { dia: 7, asignatura: "Matemáticas", tema: "Fracciones" }]), true);
    assert.equal(hayClases([]), false);
  });

  test("la ficha de un alumno sin clases: no genera nada al abrirse, y un «Sin actividad» viejo no se ofrece (1/10/2026)", async () => {
    const { buildInformeCard } = await import("../../assets/academia/admin/js/sections/envioFamilias/informeCard.js");
    const generados = [];
    const api = {
      fetchInformePreview: async () => ({ comentario: "Sin actividad registrada este mes.", dias: [], enviadoAt: null }),
      generarInforme: async (a) => { generados.push(a); return { comentario: "x", dias: [] }; },
    };
    const card = buildInformeCard({ id: "a1", nombre: "Aarón", curso: "1º ESO" }, { mes: 8, anio: 2026, api });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(generados.length, 0, "abrir la ficha no guarda ningún informe");
    assert.match(card.textContent, /Sin clases este mes: no lleva informe/);
    assert.equal([...card.querySelectorAll("button")].some((b) => /Editar informe|Generar informe/.test(b.textContent)), false);
  });

  test("enviar: un informe sin clases ese mes no sale, aunque tenga el «Sin actividad» guardado", async () => {
    const { enviarInformeDeAlumno } = await import("../../server/lib/academiaEnvio/enviarInformeIndividual.js");
    const admin = makeFakeSupabaseAdmin({
      academia_alumnos: [{ id: A, tenant_id: T, nombre: "Ana", curso: "1º ESO", familia_id: "f1", familia: { id: "f1", nombre: "F", email: "f@example.com" } }],
      academia_sesiones: [],
      academia_festivos: [],
      academia_informes: [{ id: "i1", tenant_id: T, alumno_id: A, mes: 8, anio: 2026, comentario: "Sin actividad registrada este mes.", enviado_at: null }],
      academia_config: [{ tenant_id: T }],
      academia_textos_legales: [],
    });
    const emails = [];
    const r = await enviarInformeDeAlumno(admin, {
      tenantId: T, tenantNombre: "Lyceo", alumnoId: A, mes: 8, anio: 2026, apiKey: "", pdfServiceUrl: "http://pdf.test",
      generarInformePdfFn: async () => ({ ok: true, buffer: Buffer.from("x") }), enviarEmailFn: async (e) => { emails.push(e); },
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, "sin_sesiones");
    assert.equal(emails.length, 0);
  });

  test("el selector del envío dice qué informe lleva cada mes (modo del mes anterior)", async () => {
    const { etiquetaDelEnvio, buildCabecera } = await import("../../assets/academia/admin/js/sections/envioFamilias/cabecera.js");
    const e = etiquetaDelEnvio(10, { mes: 9, anio: 2026 });
    assert.equal(e(10), "Octubre · informe de septiembre");
    assert.equal(e(1), "Enero · informe de diciembre");
    assert.equal(etiquetaDelEnvio(10, { mes: 10, anio: 2026 }) === null, true, "mismo mes: el selector de siempre");
    const head = buildCabecera({ mes: 10, anio: 2026, periodoInforme: { mes: 9, anio: 2026 }, mesesEnviados: [9], anioActualSistema: 2026, hayPendientes: false, onCambiarPeriodo: () => {}, onRegenerar: async () => {}, onEnviar: async () => {} });
    const opciones = [...head.querySelectorAll(".ef-selector-mes-desplegable option")].map((o) => o.textContent);
    assert.equal(opciones[9], "Octubre · informe de septiembre");
    assert.equal(opciones[8], "Septiembre · informe de agosto ✓");
  });
}
