import { Window } from "happy-dom";

// Un documento propio, sin tocar el global: otros tests cuentan lo que hay
// en el documento global y no deben ver lo que se monta aquí.
const window = new Window();
const document = window.document;

// RECURSOS → HOJAS DE EJERCICIOS (js/recursos/pantallaDeHojas.js). La API,
// el iframe de la hoja y el diálogo se sustituyen por falsos que apuntan lo
// que les piden.
export async function run({ test, assert }) {
  const { createPantallaDeHojas } = await import("../../../assets/teacher/js/recursos/pantallaDeHojas.js");
  const { crearMontajeDeRecursos } = await import("../../../assets/teacher/js/recursos/montarRecursos.js");

  const BAT = (clave, dificultad = 1) => ({ clave, nombre: `N-${clave}`, dificultad });
  const CATALOGO = {
    temas: [{
      id: "t1", curso: "1.º ESO", materia: "Matemáticas", nombre: "Enteros",
      objetivos: [
        { numero: 1, titulo: "Uno", maxActividades: 5, baterias: [BAT("a"), BAT("b", 2)] },
        { numero: 2, titulo: "Dos", maxActividades: 3, baterias: [BAT("d")] },
      ],
    }],
    intensidades: ["repaso", "normal", "refuerzo"],
  };
  const HUECO = (orden, clave) => ({ orden, clave, objetivo: 1, esRepaso: false, nombre: `N-${clave}`, dificultad: 1, concepto: `C-${clave}` });
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const cambia = (el, valor) => { el.value = valor; el.dispatchEvent(new window.Event("change")); };

  function montar({ interpretar } = {}) {
    const llamadas = { generar: [], actividad: [], interpretar: [], pintadas: [], pdf: [], dialogos: [] };
    const api = {
      catalogo: async () => CATALOGO,
      generar: async (e) => {
        llamadas.generar.push(e);
        return {
          hoja: { actividades: [{ enunciado: "A", apartados: ["$1+1=$ ___"] }, { enunciado: "B" }, { enunciado: "C", tipo: "problema" }] },
          huecos: [HUECO(1, "a"), HUECO(2, "b"), HUECO(3, "a")],
        };
      },
      actividad: async (p) => {
        llamadas.actividad.push(p);
        return { actividad: { enunciado: `nuevo-${p.clave}` }, hueco: { ...HUECO(0, p.clave) } };
      },
      interpretar: interpretar || (async (x) => { llamadas.interpretar.push(x); return { accion: "ejercicio", clave: "b" }; }),
    };
    let dialogo = null;
    const pantalla = createPantallaDeHojas({
      api,
      doc: document,
      centro: "instituto prueba",
      createVisorFn: () => ({ el: document.createElement("div"), pintar: (h) => llamadas.pintadas.push(h), elegir: () => {} }),
      abrirDialogoFn: (opciones) => {
        dialogo = { opciones, cerrado: false, avisos: [] };
        llamadas.dialogos.push(dialogo);
        return {
          cerrar: () => { dialogo.cerrado = true; },
          setOcupado: () => {},
          aviso: (t) => dialogo.avisos.push(t),
        };
      },
      pedirPdfFn: async (hoja) => { llamadas.pdf.push(hoja); return "blob"; },
      abrirPdfFn: async ({ pedirPdfFn }) => pedirPdfFn(),
    });
    const raiz = document.createElement("section");
    document.body.replaceChildren(raiz);
    return { pantalla, raiz, llamadas, get dialogo() { return dialogo; } };
  }

  test("al abrir monta una hoja del primer tema y objetivo, y pinta una fila por ejercicio", async () => {
    const m = montar();
    await m.pantalla.render(m.raiz);
    assert.equal(m.llamadas.generar.length, 1);
    assert.equal(m.llamadas.generar[0].temaId, "t1");
    assert.equal(m.llamadas.generar[0].objetivo, 1);
    assert.equal(m.raiz.querySelectorAll(".rc-slot").length, 3);
    assert.equal(m.raiz.querySelector(".rc-h1").textContent, "Uno");
    // Lo que se enseña de cada ejercicio: su concepto, su dificultad, su tipo.
    assert.ok(m.raiz.querySelector(".rc-slot").textContent.includes("C-a"));
    assert.ok(m.raiz.querySelector(".rc-slot[data-orden='3'] .rc-tag--probl"));
    assert.equal(m.llamadas.pintadas[0].centro, "instituto prueba");
  });

  test("cambiar el objetivo o 'Volver a montar' monta otra hoja al momento", async () => {
    const m = montar();
    await m.pantalla.render(m.raiz);
    const selects = m.raiz.querySelectorAll(".rc-ctx select");
    cambia(selects[3], "2");
    await tick();
    assert.equal(m.llamadas.generar.at(-1).objetivo, 2);
    [...m.raiz.querySelectorAll(".rc-ctx button")].find((b) => b.textContent === "Volver a montar").click();
    await tick();
    assert.equal(m.llamadas.generar.length, 3);
  });

  test("QUITAR un ejercicio lo saca de la lista y de la hoja sin volver a montarla", async () => {
    const m = montar();
    await m.pantalla.render(m.raiz);
    [...m.raiz.querySelectorAll(".rc-slot[data-orden='2'] button")].find((b) => b.textContent === "Quitar").click();
    assert.equal(m.raiz.querySelectorAll(".rc-slot").length, 2);
    assert.equal(m.llamadas.pintadas.at(-1).actividades.length, 2);
    assert.equal(m.llamadas.generar.length, 1);
  });

  test("CAMBIAR abre el diálogo con ese ejercicio; 'otro del mismo tipo' pide la misma batería", async () => {
    const m = montar();
    await m.pantalla.render(m.raiz);
    [...m.raiz.querySelectorAll(".rc-slot[data-orden='2'] button")].find((b) => b.textContent === "Cambiar").click();
    assert.equal(m.dialogo.opciones.orden, 2);
    assert.deepEqual(m.dialogo.opciones.baterias.map((b) => b.clave), ["a", "b"]);
    // Mientras se cambia, la fila lo dice y no ofrece "Cambiar" otra vez.
    assert.ok(m.raiz.querySelector(".rc-slot[data-orden='2']").classList.contains("is-hl"));
    await m.dialogo.opciones.onAzar();
    assert.equal(m.llamadas.actividad[0].clave, "b");
    assert.equal(m.dialogo.cerrado, true);
    assert.equal(m.llamadas.pintadas.at(-1).actividades[1].enunciado, "nuevo-b");
    assert.ok(!m.raiz.querySelector(".rc-slot.is-hl"));
  });

  test("elegir del catálogo cambia por ESA batería", async () => {
    const m = montar();
    await m.pantalla.render(m.raiz);
    [...m.raiz.querySelectorAll(".rc-slot[data-orden='1'] button")].find((b) => b.textContent === "Cambiar").click();
    await m.dialogo.opciones.onClave("b");
    assert.equal(m.llamadas.actividad[0].clave, "b");
  });

  test("PEDIR ALGO CONCRETO: la IA elige una batería y se cambia; con el ejercicio elegido en el contexto", async () => {
    const m = montar();
    await m.pantalla.render(m.raiz);
    [...m.raiz.querySelectorAll(".rc-slot[data-orden='3'] button")].find((b) => b.textContent === "Cambiar").click();
    const r = await m.dialogo.opciones.onPedido([{ rol: "profesor", texto: "uno de comparar" }]);
    assert.deepEqual(r, { hecho: true });
    assert.deepEqual(m.llamadas.interpretar[0].contexto.ejercicio, { orden: 3, objetivo: 1, clave: "a" });
    assert.equal(m.llamadas.actividad[0].clave, "b");
  });

  test("si la IA pregunta o dice que no está, el diálogo sigue abierto con la pregunta o el aviso", async () => {
    let respuesta = { accion: "pregunta", pregunta: "¿Más fácil?", opciones: ["Sí"] };
    const m = montar({ interpretar: async () => respuesta });
    await m.pantalla.render(m.raiz);
    [...m.raiz.querySelectorAll(".rc-slot[data-orden='1'] button")].find((b) => b.textContent === "Cambiar").click();
    assert.deepEqual(await m.dialogo.opciones.onPedido([{ rol: "profesor", texto: "x" }]), { pregunta: "¿Más fácil?", opciones: ["Sí"] });
    respuesta = { accion: "fuera_de_catalogo", explicacion: "Las raíces no están en este tema." };
    assert.deepEqual(await m.dialogo.opciones.onPedido([{ rol: "profesor", texto: "raíces" }]), { aviso: "Las raíces no están en este tema." });
    assert.equal(m.dialogo.cerrado, false);
    assert.equal(m.llamadas.actividad.length, 0);
  });

  test("'PDF para imprimir' manda la hoja tal como está, con los cambios y el centro", async () => {
    const m = montar();
    await m.pantalla.render(m.raiz);
    [...m.raiz.querySelectorAll(".rc-slot[data-orden='1'] button")].find((b) => b.textContent === "Quitar").click();
    const pdf = [...m.raiz.querySelectorAll("button")].find((b) => b.textContent === "PDF para imprimir");
    pdf.click();
    await tick();
    assert.equal(m.llamadas.pdf[0].actividades.length, 2);
    assert.equal(m.llamadas.pdf[0].centro, "instituto prueba");
  });

  test("MIENTRAS SE HACE EL PDF el botón lo dice (tarda unos segundos) y luego vuelve", async () => {
    const m = montar();
    let duranteTexto = null;
    let soltar;
    const espera = new Promise((r) => { soltar = r; });
    const pantalla = createPantallaDeHojas({
      doc: document,
      api: { catalogo: async () => CATALOGO, generar: async () => ({ hoja: { actividades: [{ enunciado: "A" }] }, huecos: [HUECO(1, "a")] }) },
      createVisorFn: () => ({ el: document.createElement("div"), pintar() {}, elegir() {} }),
      pedirPdfFn: async () => "blob",
      abrirPdfFn: async () => { await espera; },
    });
    await pantalla.render(m.raiz);
    const pdf = m.raiz.querySelector(".rc-head button");
    pdf.click();
    await tick();
    duranteTexto = pdf.textContent;
    assert.ok(pdf.classList.contains("is-cargando"));
    assert.equal(pdf.disabled, true);
    soltar();
    await tick(); await tick();
    assert.equal(duranteTexto, "Preparando el PDF…");
    assert.equal(pdf.textContent, "PDF para imprimir");
    assert.equal(pdf.classList.contains("is-cargando"), false);
  });

  test("MOVER con el teclado: flecha abajo sobre el asa lo baja un puesto y el asa sigue enfocada", async () => {
    const m = montar();
    await m.pantalla.render(m.raiz);
    const asa = m.raiz.querySelector(".rc-slot[data-orden='1'] .rc-slot__asa");
    asa.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    const ultima = m.llamadas.pintadas.at(-1).actividades.map((a) => a.enunciado);
    assert.deepEqual(ultima, ["B", "A", "C"]);
    assert.equal(document.activeElement, m.raiz.querySelector(".rc-slot[data-orden='2'] .rc-slot__asa"));
    // Arriba del todo, flecha arriba no hace nada.
    const primera = m.raiz.querySelector(".rc-slot[data-orden='1'] .rc-slot__asa");
    const antes = m.llamadas.pintadas.length;
    primera.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    assert.equal(m.llamadas.pintadas.length, antes);
  });

  test("AÑADIR: abre el diálogo en modo añadir; 'al azar' prefiere un tipo que aún no está en la hoja", async () => {
    const m = montar();
    await m.pantalla.render(m.raiz);
    [...m.raiz.querySelectorAll(".rc-lista__pie button")].find((b) => b.textContent.includes("Añadir")).click();
    assert.equal(m.dialogo.opciones.modo, "anadir");
    assert.equal(m.dialogo.opciones.orden, 4);
    await m.dialogo.opciones.onAzar();
    // La hoja tiene a y b del objetivo 1: no queda ninguno nuevo, así que
    // vale cualquiera de los dos; lo importante es que se añade al final.
    assert.ok(["a", "b"].includes(m.llamadas.actividad[0].clave));
    assert.equal(m.raiz.querySelectorAll(".rc-slot").length, 4);
    assert.equal(m.dialogo.cerrado, true);
  });

  test("AÑADIR pidiéndolo con palabras manda `nuevo` en el contexto, no un ejercicio elegido", async () => {
    const m = montar();
    await m.pantalla.render(m.raiz);
    [...m.raiz.querySelectorAll(".rc-lista__pie button")].find((b) => b.textContent.includes("Añadir")).click();
    await m.dialogo.opciones.onPedido([{ rol: "profesor", texto: "uno de restar" }]);
    assert.deepEqual(m.llamadas.interpretar[0].contexto.nuevo, { objetivo: 1 });
    assert.equal(m.llamadas.interpretar[0].contexto.ejercicio, undefined);
    assert.equal(m.raiz.querySelectorAll(".rc-slot").length, 4);
  });

  test("con la asignatura sin hojas (Música) se avisa; con Matemáticas, no", async () => {
    let asignatura = "Música";
    const pantalla = createPantallaDeHojas({
      doc: document,
      getAsignatura: () => asignatura,
      api: { catalogo: async () => CATALOGO, generar: async () => ({ hoja: { actividades: [{ enunciado: "A" }] }, huecos: [HUECO(1, "a")] }) },
      createVisorFn: () => ({ el: document.createElement("div"), pintar() {}, elegir() {} }),
    });
    const raiz = document.createElement("section");
    await pantalla.render(raiz);
    const aviso = raiz.querySelector(".rc-ban");
    assert.equal(aviso.hidden, false);
    assert.ok(aviso.textContent.includes("Música"));
    asignatura = "matematicas";
    pantalla.revisarAsignatura();
    assert.equal(aviso.hidden, true);
  });

  test("TODO EL TEMA: es la primera opción del objetivo, se pide con todoElTema y 'Ejercicios' no se elige", async () => {
    const m = montar();
    await m.pantalla.render(m.raiz);
    const selects = m.raiz.querySelectorAll(".rc-ctx select");
    assert.equal(selects[3].options[0].value, "tema");
    cambia(selects[3], "tema");
    await tick();
    const pedida = m.llamadas.generar.at(-1);
    assert.equal(pedida.todoElTema, true);
    assert.equal(pedida.objetivo, 2, "el último objetivo del tema");
    assert.equal(selects[5].disabled, true);
    assert.ok(m.raiz.querySelector(".rc-h1").textContent.startsWith("Todo el tema"));
    cambia(selects[3], "1");
    await tick();
    assert.equal(m.llamadas.generar.at(-1).todoElTema, false);
    assert.equal(selects[5].disabled, false);
  });

  test("si falla el catálogo se dice, sin pantalla a medias", async () => {
    const pantalla = createPantallaDeHojas({
      doc: document,
      api: { catalogo: async () => { throw new Error("Sin permiso"); } },
      createVisorFn: () => ({ el: document.createElement("div"), pintar() {}, elegir() {} }),
    });
    const raiz = document.createElement("section");
    await pantalla.render(raiz);
    assert.equal(raiz.textContent, "Sin permiso");
  });

  test("Recursos se monta UNA vez, la primera que se abre", () => {
    let veces = 0;
    const al = crearMontajeDeRecursos({ raiz: {}, crearPantallaFn: () => ({ render: () => { veces += 1; } }) });
    al(); al(); al();
    assert.equal(veces, 1);
  });
}
