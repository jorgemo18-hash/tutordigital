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
    const llamadas = { generar: [], actividad: [], interpretar: [], pintadas: [], pdf: [], dialogos: [], guardar: [], recientes: 0 };
    const guardadas = [];
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
      guardar: async (x) => {
        llamadas.guardar.push(x);
        const g = { id: `id${guardadas.length + 1}`, codigo: `H-260923-0${guardadas.length + 1}`, ...x };
        guardadas.push(g);
        return { id: g.id, codigo: g.codigo };
      },
      recientes: async () => {
        llamadas.recientes += 1;
        return { hojas: guardadas.map((g) => ({ id: g.id, codigo: g.codigo, objetivo: g.hoja.objetivo || "Uno", tema: "Enteros", curso: "1.º ESO", created_at: "2026-09-23T10:00:00Z" })) };
      },
      abrir: async (id) => {
        const g = guardadas.find((x) => x.id === id);
        return { id: g.id, codigo: g.codigo, contenido: { ...g.hoja, codigo: g.codigo }, huecos: g.huecos, parametros: g.parametros };
      },
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

  test("PASO 2: EL PRIMER PDF GUARDA LA HOJA Y SALE CON SU CÓDIGO; el segundo, sin cambios, no gasta otro", async () => {
    const m = montar();
    await m.pantalla.render(m.raiz);
    const pdf = m.raiz.querySelector(".rc-head .rc-btn--pri");
    pdf.click();
    await tick(); await tick();
    assert.equal(m.llamadas.guardar.length, 1);
    assert.deepEqual(m.llamadas.guardar[0].parametros, { temaId: "t1", objetivo: 1, intensidad: "normal" });
    assert.equal(m.llamadas.guardar[0].hoja.centro, "instituto prueba");
    assert.equal(m.llamadas.pdf[0].codigo, "H-260923-01", "el código va en el papel");
    assert.equal(m.llamadas.pintadas.at(-1).codigo, "H-260923-01", "y en la vista previa");
    assert.equal(m.raiz.querySelector(".rc-head .rc-tag--mono").textContent, "H-260923-01");
    pdf.click();
    await tick(); await tick();
    assert.equal(m.llamadas.guardar.length, 1, "misma hoja: mismo código, no se guarda otra vez");
    assert.equal(m.llamadas.pdf[1].codigo, "H-260923-01");
  });

  test("TOCAR LA HOJA le quita el código; el siguiente PDF guarda una nueva", async () => {
    const m = montar();
    await m.pantalla.render(m.raiz);
    m.raiz.querySelector(".rc-head .rc-btn--pri").click();
    await tick(); await tick();
    [...m.raiz.querySelectorAll(".rc-slot[data-orden='3'] button")].find((b) => b.textContent === "Quitar").click(); // Quitar
    assert.equal(m.llamadas.pintadas.at(-1).codigo, "");
    assert.equal(m.raiz.querySelector(".rc-head .rc-tag--mono").hidden, true);
    m.raiz.querySelector(".rc-head .rc-btn--pri").click();
    await tick(); await tick();
    assert.equal(m.llamadas.guardar.length, 2);
    assert.equal(m.llamadas.pdf.at(-1).codigo, "H-260923-02");
  });

  test("HOJAS RECIENTES: se listan con su código; abrir una la pone tal cual y reimprime con el mismo código", async () => {
    const m = montar();
    await m.pantalla.render(m.raiz);
    [...m.raiz.querySelectorAll(".rc-slot[data-orden='1'] button")].find((b) => b.textContent === "Quitar").click(); // Quitar: hoja de 2
    m.raiz.querySelector(".rc-head .rc-btn--pri").click();
    await tick(); await tick();
    cambia(m.raiz.querySelectorAll(".rc-ctx select")[3], "2"); // otra hoja
    await tick();
    const fila = m.raiz.querySelector(".rc-recientes__fila");
    assert.ok(fila.textContent.includes("H-260923-01"));
    fila.querySelector("button").click();
    await tick(); await tick();
    assert.equal(m.raiz.querySelectorAll(".rc-slot").length, 2, "la hoja guardada, con su retoque");
    assert.equal(m.raiz.querySelectorAll(".rc-ctx select")[3].value, "1", "los desplegables como se pidió");
    assert.equal(m.llamadas.pintadas.at(-1).codigo, "H-260923-01");
    m.raiz.querySelector(".rc-head .rc-btn--pri").click();
    await tick(); await tick();
    assert.equal(m.llamadas.guardar.length, 1, "reimprimir una reciente sin tocarla no gasta código");
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
    const pdf = m.raiz.querySelector(".rc-head .rc-btn--pri");
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

  test("CADA EJERCICIO lleva su saber básico con la cita, en su fila", async () => {
    const saber = { codigo: "A.3", nombre: "Sentido de las operaciones", vineta: "Operaciones…", implicito: false };
    const pantalla = createPantallaDeHojas({
      doc: document,
      api: { catalogo: async () => CATALOGO, generar: async () => ({ hoja: { actividades: [{ enunciado: "A" }, { enunciado: "B" }] }, huecos: [{ ...HUECO(1, "a"), saber }, HUECO(2, "b")] }) },
      createVisorFn: () => ({ el: document.createElement("div"), pintar() {}, elegir() {} }),
    });
    const raiz = document.createElement("section");
    await pantalla.render(raiz);
    const primera = raiz.querySelector(".rc-slot[data-orden='1'] .rc-slot__saber");
    assert.ok(primera.textContent.includes("A.3 · Sentido de las operaciones") && primera.textContent.includes("«Operaciones…»"));
    assert.equal(raiz.querySelector(".rc-slot[data-orden='2'] .rc-slot__saber"), null, "sin saber, sin línea");
  });

  test("MÓVIL: resumen plegado de la hoja, PDF abajo, 'Ver folio' a pantalla completa, subir/bajar con botones", async () => {
    const m = montar();
    const pantalla = createPantallaDeHojas({
      doc: document, movil: true,
      api: { catalogo: async () => CATALOGO, generar: async () => ({ hoja: { actividades: [{ enunciado: "A" }, { enunciado: "B" }] }, huecos: [HUECO(1, "a"), HUECO(2, "b")] }) },
      createVisorFn: () => ({ el: document.createElement("div"), pintar: (h) => m.llamadas.pintadas.push(h), elegir() {} }),
    });
    const raiz = document.createElement("section");
    raiz.className = "rc";
    document.body.replaceChildren(raiz);
    await pantalla.render(raiz);
    assert.ok(raiz.classList.contains("rc--movil"));
    assert.equal(raiz.querySelector(".rc-ctx-plegable__resumen").textContent, "1.º ESO · Matemáticas · Objetivo 1 · Normal");
    assert.ok(raiz.querySelector(".rc-barra-movil .rc-btn--pri"), "el PDF, en la barra de abajo");
    assert.equal(raiz.querySelector(".rc-head .rc-btn--pri"), null);
    const ver = [...raiz.querySelectorAll(".rc-barra-movil button")].find((b) => b.textContent === "Ver folio");
    ver.click();
    assert.ok(raiz.querySelector(".rc-cuerpo").classList.contains("rc-cuerpo--folio"));
    [...raiz.querySelectorAll(".rc-previa button")].find((b) => b.textContent.includes("Volver")).click();
    assert.equal(raiz.querySelector(".rc-cuerpo").classList.contains("rc-cuerpo--folio"), false);
    // Bajar el primero con su botón.
    raiz.querySelector(".rc-slot[data-orden='1'] [aria-label='Bajar el ejercicio 1']").click();
    assert.deepEqual(m.llamadas.pintadas.at(-1).actividades.map((a) => a.enunciado), ["B", "A"]);
    assert.equal(raiz.querySelector(".rc-slot[data-orden='1'] [aria-label='Subir el ejercicio 1']").disabled, true);
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

  test("Recursos se monta UNA vez, la primera que se abre; el Currículo, al abrir su pestaña", () => {
    let hojas = 0;
    let curriculo = 0;
    const raiz = document.createElement("section");
    const al = crearMontajeDeRecursos({
      raiz, doc: document,
      crearPantallaFn: () => ({ render: () => { hojas += 1; } }),
      crearCurriculoFn: () => ({ render: () => { curriculo += 1; } }),
    });
    al(); al(); al();
    assert.equal(hojas, 1);
    assert.equal(curriculo, 0, "no se carga hasta que se abre");
    raiz.querySelectorAll(".rc-subnav__btn")[1].click();
    raiz.querySelectorAll(".rc-subnav__btn")[1].click();
    assert.equal(curriculo, 1);
    assert.equal(raiz.querySelector('[data-sub="hojas"]').hidden, true);
  });
}
