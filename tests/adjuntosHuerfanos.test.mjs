import fs from "node:fs";

// BORRAR UNA TAREA BORRA SUS ARCHIVOS (24/09/2026: 85 de 87 archivos del
// bucket eran de tareas borradas o no tenían fila).
export async function run({ test, assert }) {
  const RAIZ = new URL("../", import.meta.url).pathname;
  const { borrarAdjuntosDeTarea } = await import("../server/lib/attachments/borrarAdjuntosDeTarea.js");
  const { clasificarHuerfanos } = await import("../scripts/lib/adjuntosHuerfanos.mjs");

  function fakeAdmin({ adjuntos = [], deSesion = [], storageFalla = false } = {}) {
    const hecho = { removidos: [], filasBorradas: 0 };
    return {
      hecho,
      storage: { from: () => ({ remove: async (rutas) => { hecho.removidos.push(...rutas); return { error: storageFalla ? { message: "caído" } : null }; } }) },
      from(tabla) {
        const q = {
          _borrar: false,
          select() { return q; }, eq() { return q; },
          delete() { q._borrar = true; return q; },
          then(r) {
            if (q._borrar) { hecho.filasBorradas += 1; return r({ error: null }); }
            return r({ data: tabla === "attachments" ? adjuntos : deSesion, error: null });
          },
        };
        return q;
      },
    };
  }

  test("REGRESIÓN: borrar la tarea borra los archivos del bucket, no solo las filas", async () => {
    const admin = fakeAdmin({ adjuntos: [{ storage_path: "c/t/enunciado.pdf" }], deSesion: [{ storage_path: "c/t/cuaderno.jpg" }] });
    const r = await borrarAdjuntosDeTarea(admin, { tenantId: "c", taskId: "t" });
    assert.equal(r.ok, true);
    assert.deepEqual(admin.hecho.removidos, ["c/t/enunciado.pdf", "c/t/cuaderno.jpg"]);
    assert.equal(admin.hecho.filasBorradas, 1);
  });

  test("si Storage falla, la tarea se borra igual y queda avisado", async () => {
    const admin = fakeAdmin({ adjuntos: [{ storage_path: "c/t/a.pdf" }], storageFalla: true });
    const r = await borrarAdjuntosDeTarea(admin, { tenantId: "c", taskId: "t" });
    assert.equal(r.ok, true);
    assert.ok(r.avisoStorage);
  });

  test("la ruta de borrar tarea usa el borrado de archivos", () => {
    const src = fs.readFileSync(`${RAIZ}server/routes/v1/tasks.routes.js`, "utf8");
    assert.match(src, /borrarAdjuntosDeTarea\(admin, \{ tenantId: auth\.tenant\.id, taskId \}\)/);
  });

  test("el barrido: fila de tarea borrada, archivo sin fila, y respeta lo recién subido", () => {
    const ahora = new Date("2026-09-24T12:00:00Z");
    const r = clasificarHuerfanos({
      adjuntos: [{ id: 1, owner_id: "viva", storage_path: "c/viva/a" }, { id: 2, owner_id: "muerta", storage_path: "c/muerta/b", size: 1024, created_at: "2026-05-01" }],
      deSesion: [{ storage_path: "c/viva/sesion" }],
      tareas: [{ id: "viva" }],
      archivos: [
        { ruta: "c/viva/a", creado: "2026-05-01" }, { ruta: "c/viva/sesion", creado: "2026-05-01" },
        { ruta: "c/muerta/b", creado: "2026-05-01" },
        { ruta: "c/x/suelto", creado: "2026-06-01", bytes: 2048 },
        { ruta: "c/x/subiendo", creado: "2026-09-24T11:59:00Z" },
      ],
      ahora,
    });
    assert.deepEqual(r.filas.map((f) => f.id), [2]);
    assert.deepEqual(r.sueltos.map((a) => a.ruta), ["c/x/suelto"], "c/muerta/b tiene fila (la huérfana): no cuenta dos veces; lo recién subido no se toca");
  });

  test("el script sin --borrar no borra nada", () => {
    const src = fs.readFileSync(`${RAIZ}scripts/limpiar-adjuntos-huerfanos.mjs`, "utf8");
    assert.match(src, /if \(!BORRAR\) \{[\s\S]{0,200}return;/);
  });
}
