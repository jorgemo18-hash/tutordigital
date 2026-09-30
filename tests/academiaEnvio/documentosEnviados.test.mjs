import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// EL PDF EXACTO DE CADA ENVÍO (Jorge, 30/09/2026: "tienen que guardarse, por
// si tengo que justificarlo; y si lo mando dos veces, que se vea el último").
// Ver server/lib/academiaEnvio/documentosEnviados.js y la migración 147.
function conStorage(admin, { falla = false } = {}) {
  const subidos = [];
  admin.storage = {
    from: (bucket) => ({
      upload: async (path, buffer, opts) => {
        if (falla) return { error: { message: "storage caído" } };
        subidos.push({ bucket, path, buffer, opts });
        return { error: null };
      },
    }),
  };
  admin._subidos = subidos;
  return admin;
}

export async function run({ test, assert }) {
  const { guardarDocumentosEnviados, fetchDocumentosEnviados } = await import("../../server/lib/academiaEnvio/documentosEnviados.js");
  const { enviarReciboYInformesDeFamilia } = await import("../../server/lib/academiaEnvio/enviarFamiliaEmail.js");
  const { textoPdfEnviado } = await import("../../assets/academia/admin/js/sections/envioFamilias/pdfEnviado.js");

  test("guarda cada PDF en el bucket privado, con su mes, y nunca pisa uno anterior", async () => {
    const admin = conStorage(makeFakeSupabaseAdmin({ academia_documentos_enviados: [] }));
    const docs = [
      { tipo: "recibo", buffer: Buffer.from("R"), nombreArchivo: "recibo-ruiz-octubre-2026.pdf", mes: 10, anio: 2026, reciboId: "r1" },
      { tipo: "informe", buffer: Buffer.from("I"), nombreArchivo: "informe-eric-septiembre-2026.pdf", mes: 9, anio: 2026, alumnoId: "a1" },
    ];
    await guardarDocumentosEnviados(admin, { tenantId: "t1", envioId: "e1", familiaId: "f1", destinatario: "r@x.es", documentos: docs, ahora: new Date("2026-10-05T10:32:00Z") });
    await guardarDocumentosEnviados(admin, { tenantId: "t1", envioId: "e2", familiaId: "f1", destinatario: "r@x.es", documentos: docs.slice(0, 1), ahora: new Date("2026-10-05T11:00:00Z") });

    assert.equal(admin._subidos.length, 3);
    assert.ok(admin._subidos.every((s) => s.bucket === "academia-documentos" && s.opts.upsert === false));
    assert.equal(new Set(admin._subidos.map((s) => s.path)).size, 3, "cada envío deja su archivo");
    assert.match(admin._subidos[1].path, /^t1\/envios\/2026-09\/f1\/2026-10-05T10-32-00-000Z-informe-eric-septiembre-2026\.pdf$/);

    const { documentos } = await fetchDocumentosEnviados(admin, "t1", { familiaId: "f1", tipo: "recibo", mes: 10, anio: 2026 });
    assert.equal(documentos.length, 2);
    assert.equal(documentos[0].enviado_at, "2026-10-05T11:00:00.000Z", "el último primero");
  });

  test("al enviar a una familia se guardan su recibo y sus informes con el mes de cada uno", async () => {
    const admin = conStorage(makeFakeSupabaseAdmin({
      academia_familias: [{ id: "f1", tenant_id: "t1", nombre: "Familia Ruiz", email: "r@x.es" }],
      academia_alumnos: [{ id: "a1", tenant_id: "t1", familia_id: "f1", nombre: "Eric", curso: "1º ESO", activo: true }],
      academia_config: [{ tenant_id: "t1", nombre_emisor: "Lyceo", modo_envio: "informe_mes_anterior" }],
      academia_recibos: [{ id: "r1", tenant_id: "t1", familia_id: "f1", mes: 10, anio: 2026, estado: "borrador", total_bruto: 85, total_neto: 85, total_descuento: 0, numero_recibo: "REC-2026-040", concepto: "Octubre", familia: { id: "f1", nombre: "Familia Ruiz", email: "r@x.es" } }],
      academia_recibos_lineas: [{ id: "l1", recibo_id: "r1", alumno_id: "a1", nombre_alumno: "Eric", precio_bruto: 85, descuentos_recurrentes: [] }],
      academia_informes: [{ id: "i1", tenant_id: "t1", alumno_id: "a1", mes: 9, anio: 2026, comentario: "Bien", enviado_at: null }],
      academia_sesiones: [], academia_festivos: [], academia_textos_legales: [], academia_documentos_enviados: [],
    }));
    const r = await enviarReciboYInformesDeFamilia(admin, {
      tenantId: "t1", tenantNombre: "Lyceo", familiaId: "f1", mes: 10, anio: 2026, pdfServiceUrl: "http://pdf",
      generarReciboPdfFn: async () => ({ ok: true, buffer: Buffer.from("R") }),
      generarInformePdfFn: async () => ({ ok: true, buffer: Buffer.from("I") }),
      enviarEmailFn: async () => ({ id: "re_1" }),
    });
    assert.equal(r.ok, true, r.motivo);
    const filas = admin._state.tables.academia_documentos_enviados;
    assert.deepEqual(filas.map((f) => [f.tipo, f.mes]).sort(), [["informe", 9], ["recibo", 10]]);
    assert.ok(filas.every((f) => f.familia_id === "f1" && f.destinatario === "r@x.es"));
  });

  test("si guardar el PDF falla, el envío sigue siendo un éxito (el correo ya salió) y queda en el log", async () => {
    const avisos = [];
    const admin = conStorage(makeFakeSupabaseAdmin({
      academia_familias: [{ id: "f1", tenant_id: "t1", nombre: "Familia Ruiz", email: "r@x.es" }],
      academia_alumnos: [], academia_config: [{ tenant_id: "t1" }],
      academia_recibos: [{ id: "r1", tenant_id: "t1", familia_id: "f1", mes: 10, anio: 2026, estado: "borrador", total_neto: 85, familia: { id: "f1", nombre: "Familia Ruiz" } }],
      academia_recibos_lineas: [], academia_textos_legales: [], academia_documentos_enviados: [],
    }), { falla: true });
    const r = await enviarReciboYInformesDeFamilia(admin, {
      tenantId: "t1", tenantNombre: "Lyceo", familiaId: "f1", mes: 10, anio: 2026, pdfServiceUrl: "http://pdf",
      generarReciboPdfFn: async () => ({ ok: true, buffer: Buffer.from("R") }),
      enviarEmailFn: async () => ({ id: "re_2" }),
      logWarnFn: (obj, msg) => avisos.push(msg),
    });
    assert.equal(r.ok, true);
    assert.ok(avisos.includes("pdf enviado no guardado"));
  });

  test("la línea dice cuándo y, si se mandó más de una vez, que es el último", () => {
    const d = (iso) => ({ id: iso, enviado_at: iso });
    assert.equal(textoPdfEnviado([]), "");
    assert.match(textoPdfEnviado([d("2026-10-05T10:32:00")]), /^Enviado el 5 oct\. a las 10:32$/);
    assert.match(textoPdfEnviado([d("2026-10-05T11:00:00"), d("2026-10-05T10:32:00")]), /se ha enviado 2 veces; este es el último/);
  });
  test("supresión: al eliminar a un alumno se quitan los PDF de SUS informes; los recibos y los de otros, no", async () => {
    const { quitarInformesEnviadosDelAlumno } = await import("../../server/lib/academiaEnvio/documentosEnviados.js");
    const fila = (id, tipo, alumno_id) => ({ id, tenant_id: "t1", familia_id: "f1", tipo, alumno_id, mes: 9, anio: 2026, storage_path: `p/${id}`, nombre_archivo: id });
    const admin = makeFakeSupabaseAdmin({ academia_documentos_enviados: [
      fila("i-eric", "informe", "a1"), fila("i-nora", "informe", "a2"), fila("r-fam", "recibo", "a1"),
    ] });
    const { rutas, error } = await quitarInformesEnviadosDelAlumno(admin, "t1", "a1");
    assert.equal(error, undefined);
    assert.deepEqual(rutas, ["p/i-eric"]);
    assert.deepEqual(admin._state.tables.academia_documentos_enviados.map((f) => f.id).sort(), ["i-nora", "r-fam"]);
  });
  test("la ruta de eliminar al alumno quita sus informes enviados ANTES de borrarlo (después su alumno_id sería null)", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(new URL("../../server/routes/v1/academia.alumnos.archivar.routes.js", import.meta.url), "utf8");
    const quitar = src.indexOf("await quitarInformesEnviadosDelAlumno(");
    const borrar = src.search(/\.from\("academia_alumnos"\)\s*\.delete\(\)/);
    assert.ok(quitar > 0, "la ruta no quita los informes enviados");
    assert.ok(quitar < borrar, "los quita después de borrar al alumno: ya no sabría cuáles eran suyos");
  });
}
