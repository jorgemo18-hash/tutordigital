import { Window } from "happy-dom";

const window = new Window();
const document = window.document;

// RECURSOS → "PONER COMO DEBERES" (js/recursos/deberes/).
export async function run({ test, assert }) {
  const { ponerComoDeberes, siguienteDiaLectivo, blobADataUrl } = await import("../../../assets/teacher/js/recursos/deberes/ponerComoDeberes.js");
  const { abrirDialogoDeDeberes } = await import("../../../assets/teacher/js/recursos/deberes/dialogoDeDeberes.js");
  const { crearDeberesDeLaPantalla } = await import("../../../assets/teacher/js/recursos/deberes/deberesDeLaPantalla.js");
  const { createPantallaDeHojas } = await import("../../../assets/teacher/js/recursos/pantallaDeHojas.js");

  const tick = () => new Promise((r) => setTimeout(r, 0));
  const aDataUrl = async () => "data:application/pdf;base64,JVBERg==";
  function apiFalsa({ fallaAdjunto = 0 } = {}) {
    const llamadas = { tareas: [], adjuntos: [], guardar: 0 };
    let fallos = fallaAdjunto;
    return {
      llamadas,
      creaTarea: async (c) => { llamadas.tareas.push(c); return { id: `task${llamadas.tareas.length}`, ...c }; },
      subeAdjunto: async (c) => {
        if (fallos > 0) { fallos -= 1; throw new Error("archivo demasiado grande"); }
        llamadas.adjuntos.push(c);
        return { id: "adj1" };
      },
      gruposDelProfesor: async () => ({ items: [{ id: "g9", name: "4.º B" }] }),
    };
  }
  const HOJA = { id: "hoja1", codigo: "H-260924-03" };
  const DATOS = { grupoId: "g1", entrega: "2026-09-25", titulo: "  Enteros (H-260924-03)  ", nota: " solo del 1 al 4 ", asignatura: "Matemáticas" };

  test("PONER COMO DEBERES: tarea de deberes del grupo, enlazada a la hoja, y el PDF adjunto con su código", async () => {
    const api = apiFalsa();
    const r = await ponerComoDeberes({ api, hoja: HOJA, datos: DATOS, pedirPdf: async () => "blob", aDataUrl });
    assert.equal(r.adjunto, true);
    assert.deepEqual(api.llamadas.tareas[0], {
      group_id: "g1", type: "homework", title: "Enteros (H-260924-03)", due_date: "2026-09-25",
      subject_name: "Matemáticas", teacher_notes: "solo del 1 al 4", hoja_id: "hoja1",
    });
    assert.deepEqual(api.llamadas.adjuntos[0], { task_id: "task1", file_name: "Hoja H-260924-03.pdf", mime: "application/pdf", data: "data:application/pdf;base64,JVBERg==" });
  });

  test("si falla el PDF, la tarea ya existe: se devuelve con el error, sin lanzar ni crear otra", async () => {
    const api = apiFalsa({ fallaAdjunto: 1 });
    const r = await ponerComoDeberes({ api, hoja: HOJA, datos: DATOS, pedirPdf: async () => "blob", aDataUrl });
    assert.equal(r.adjunto, false);
    assert.equal(r.tarea.id, "task1");
    assert.match(r.error, /demasiado grande/);
    assert.equal(api.llamadas.tareas.length, 1);
  });

  test("entrega por defecto: el siguiente día lectivo (viernes → lunes; miércoles → jueves)", () => {
    assert.equal(siguienteDiaLectivo(new Date(2026, 8, 25)), "2026-09-28", "viernes 25 → lunes 28");
    assert.equal(siguienteDiaLectivo(new Date(2026, 8, 26)), "2026-09-28", "sábado → lunes");
    assert.equal(siguienteDiaLectivo(new Date(2026, 8, 23)), "2026-09-24");
  });

  test("blobADataUrl lee el PDF como data URL (lo que espera /api/v1/attachments)", async () => {
    const url = await blobADataUrl(new window.Blob(["%PDF"], { type: "application/pdf" }), { Lector: window.FileReader });
    assert.match(url, /^data:application\/pdf;base64,/);
  });

  const GRUPOS = [{ id: "g1", name: "1.º A" }, { id: "g2", name: "1.º B" }];
  const botonCon = (raiz, texto) => [...raiz.querySelectorAll("button")].find((b) => b.textContent.includes(texto));

  test("DIÁLOGO: el grupo elegido en el panel, entrega del siguiente lectivo, y el título sugerido", () => {
    const d = abrirDialogoDeDeberes({ doc: document, codigo: "H-1", tituloSugerido: "Enteros (H-1)", grupos: GRUPOS, grupoActivo: "g2",
      hoy: new Date(2026, 8, 25), onEnviar: async () => ({ adjunto: true }), onReintentar: async () => {} });
    assert.equal(d.el.querySelector("select").value, "g2");
    assert.equal(d.el.querySelector('input[type="date"]').value, "2026-09-28");
    assert.equal(d.el.querySelector(".rc-deberes__texto").value, "Enteros (H-1)");
    d.cerrar();
    assert.equal(document.querySelectorAll(".rc-deberes").length, 0);
  });

  test("diálogo: si el PDF falla, se queda abierto y el botón SOLO vuelve a adjuntar (no crea otra tarea)", async () => {
    let enviados = 0;
    const reintentos = [];
    const d = abrirDialogoDeDeberes({ doc: document, codigo: "H-1", tituloSugerido: "T", grupos: GRUPOS, grupoActivo: "g1",
      onEnviar: async () => { enviados += 1; return { adjunto: false, tarea: { id: "t1" }, error: "sin red" }; },
      onReintentar: async (tarea) => { reintentos.push(tarea.id); } });
    botonCon(d.el, "Poner como deberes").click();
    await tick(); await tick();
    assert.match(d.el.querySelector(".rc-modal__aviso").textContent, /La tarea está creada, pero el PDF no se pudo adjuntar: sin red/);
    const otraVez = botonCon(d.el, "Adjuntar el PDF otra vez");
    assert.ok(otraVez);
    otraVez.click();
    await tick(); await tick();
    assert.equal(enviados, 1);
    assert.deepEqual(reintentos, ["t1"]);
    assert.equal(d.el.isConnected, false, "con el PDF adjunto, se cierra");
  });

  test("diálogo: sin título no se envía; sin grupos, lo dice y no hay formulario", async () => {
    let enviados = 0;
    const d = abrirDialogoDeDeberes({ doc: document, codigo: "H-1", tituloSugerido: "", grupos: GRUPOS, grupoActivo: "g1",
      onEnviar: async () => { enviados += 1; return { adjunto: true }; }, onReintentar: async () => {} });
    botonCon(d.el, "Poner como deberes").click();
    await tick();
    assert.equal(enviados, 0);
    assert.match(d.el.textContent, /Ponle un título/);
    d.cerrar();
    const sin = abrirDialogoDeDeberes({ doc: document, codigo: "H-1", tituloSugerido: "T", grupos: [], onEnviar: async () => {}, onReintentar: async () => {} });
    assert.match(sin.el.textContent, /No tienes grupos asignados/);
    assert.equal(sin.el.querySelector("select"), null);
    sin.cerrar();
  });

  test("DESDE LA PANTALLA: guarda la hoja primero (el código va en el título), abre con los grupos del panel y avisa al acabar", async () => {
    const api = apiFalsa();
    const guardado = { id: null, async asegurar() { api.llamadas.guardar += 1; this.id = "hoja7"; return { codigo: "H-260924-07", nueva: true }; } };
    let abierto = null;
    const creadas = [];
    let guardadaAvisada = 0;
    const deberes = crearDeberesDeLaPantalla({
      api, guardado, doc: document, centro: "IES",
      getActual: () => ({ hoja: { actividades: [] }, huecos: [] }), parametros: () => ({}),
      pedirPdfFn: async (h) => { assert.equal(h.codigo, "H-260924-07"); return "blob"; },
      getGrupos: () => GRUPOS, getGrupoActivo: () => "g1", getAsignatura: () => "Matemáticas",
      getTituloDeLaHoja: () => "Sumar y restar enteros",
      onGuardada: () => { guardadaAvisada += 1; }, onHecho: (t) => creadas.push(t.id),
      abrirDialogoFn: (op) => { abierto = op; return { cerrar() {} }; },
    });
    await deberes.abrir();
    assert.equal(api.llamadas.guardar, 1);
    assert.equal(guardadaAvisada, 1, "una hoja nueva: se refrescan las recientes");
    assert.equal(abierto.tituloSugerido, "Sumar y restar enteros (H-260924-07)");
    assert.equal(abierto.grupos, GRUPOS);
    const r = await abierto.onEnviar({ grupoId: "g1", entrega: "2026-09-25", titulo: "X", nota: "" }).catch((e) => e);
    // El PDF pasa por blobADataUrl real: en el test, el Blob falso falla y
    // la tarea queda sin PDF. Lo que importa aquí: la tarea, con la hoja.
    assert.equal(api.llamadas.tareas[0].hoja_id, "hoja7");
    assert.equal(api.llamadas.tareas[0].subject_name, "Matemáticas");
    assert.deepEqual(creadas, [r.tarea.id]);
  });

  test("sin grupos en el panel, se piden a la API", async () => {
    const api = apiFalsa();
    let abierto = null;
    const deberes = crearDeberesDeLaPantalla({
      api, guardado: { id: "h", asegurar: async () => ({ codigo: "H-1", nueva: false }) }, doc: document,
      getActual: () => ({ hoja: {}, huecos: [] }), parametros: () => ({}), pedirPdfFn: async () => "blob",
      abrirDialogoFn: (op) => { abierto = op; return { cerrar() {} }; },
    });
    await deberes.abrir();
    assert.deepEqual(abierto.grupos, [{ id: "g9", name: "4.º B" }]);
  });

  test("SERVIDOR: la tarea acepta hoja_id (uuid) y comprueba que la hoja es del centro", async () => {
    const { TaskCreateSchema } = await import("../../../server/lib/validators.js");
    const base = { group_id: "11111111-1111-4111-8111-111111111111", type: "homework", title: "T" };
    assert.ok(TaskCreateSchema.safeParse({ ...base, hoja_id: "22222222-2222-4222-8222-222222222222" }).success);
    assert.ok(!TaskCreateSchema.safeParse({ ...base, hoja_id: "no-es-uuid" }).success);
    const fs = await import("node:fs");
    const src = fs.readFileSync(new URL("../../../server/routes/v1/tasks.routes.js", import.meta.url), "utf8");
    assert.match(src, /from\("contenido_hojas"\)[\s\S]{0,120}\.eq\("tenant_id", auth\.tenant\.id\)/, "la hoja se busca en el centro de quien crea la tarea");
  });

  test("PANTALLA DE HOJAS: el botón 'Poner como deberes' está, y se activa con la hoja montada", async () => {
    const abiertos = [];
    const pantalla = createPantallaDeHojas({
      doc: document,
      api: {
        catalogo: async () => ({ temas: [{ id: "t1", curso: "1.º ESO", materia: "Matemáticas", nombre: "Enteros", objetivos: [{ numero: 1, titulo: "Uno", maxActividades: 3, baterias: [] }] }], intensidades: ["normal"] }),
        generar: async () => ({ hoja: { actividades: [{ enunciado: "A" }] }, huecos: [{ orden: 1, clave: "a", objetivo: 1 }] }),
        recientes: async () => ({ hojas: [] }),
      },
      createVisorFn: () => ({ el: document.createElement("div"), pintar: () => {}, elegir: () => {} }),
      crearDeberesFn: () => ({ abrir: () => abiertos.push(1) }),
    });
    const raiz = document.createElement("section");
    await pantalla.render(raiz);
    const b = botonCon(raiz, "Poner como deberes");
    assert.ok(b);
    assert.equal(b.disabled, false);
    b.click();
    assert.equal(abiertos.length, 1);
  });
}
