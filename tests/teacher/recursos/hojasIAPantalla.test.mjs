import { Window } from "happy-dom";

const window = new Window();
const document = window.document;

// RECURSOS → HOJAS CON IA (js/recursos/hojasIA/).
export async function run({ test, assert }) {
  const { createPantallaDeHojasIA } = await import("../../../assets/teacher/js/recursos/hojasIA/pantallaDeHojasIA.js");
  const tick = () => new Promise((r) => setTimeout(r, 0));

  function montar({ cursos = [{ etapa: "eso", materia: "matematicas", curso: 2, temas: 2 }], falla = false } = {}) {
    const llamadas = { temas: [], generar: [], pintadas: [], pdf: 0 };
    const api = {
      disponiblesIA: async () => ({ cursos }),
      temasIA: async (c) => { llamadas.temas.push(c); return { temas: [{ tema: "ecuaciones-primer-grado", titulo: "Ecuaciones de primer grado" }, { tema: "funciones", titulo: "Funciones" }] }; },
      generaHojaIA: async (c) => {
        llamadas.generar.push(c);
        if (falla) throw new Error("La IA no ha respondido. Prueba otra vez.");
        return {
          hoja: { materia: "Matemáticas", curso: "2.º ESO", tema: "Ecuaciones", actividades: [{ enunciado: "Resuelve:" }, { enunciado: "Problema" }] },
          huecos: [
            { orden: 1, nombre: "ecuaciones con paréntesis", dificultad: 2, saber: { codigo: "D.4", nombre: "Igualdad y desigualdad" }, verificacion: "comprobada", solucion: "x = 7" },
            { orden: 2, nombre: "problema abierto", dificultad: 3, saber: { codigo: "D.2", nombre: "Modelo matemático" }, verificacion: "sin_verificar", solucion: "Abierto" },
          ],
          descartados: 1,
        };
      },
    };
    const visor = { el: document.createElement("iframe"), pintar: (h) => llamadas.pintadas.push(h) };
    const pantalla = createPantallaDeHojasIA({
      api, centro: "IES de prueba", doc: document, createVisorFn: () => visor,
      pedirPdfFn: async () => "pdf", abrirPdfFn: async ({ pedirPdfFn }) => { llamadas.pdf += 1; await pedirPdfFn(); },
    });
    const raiz = document.createElement("div");
    return { pantalla, raiz, llamadas };
  }
  const boton = (raiz, t) => [...raiz.querySelectorAll("button")].find((b) => b.textContent.includes(t));

  test("ofrece los cursos con referencias y sus temas; escribe la hoja y dice qué está comprobado", async () => {
    const m = montar();
    await m.pantalla.render(m.raiz);
    assert.deepEqual(m.llamadas.temas[0], { etapa: "eso", materia: "matematicas", curso: 2, temas: 2 });
    const [curso, tema] = m.raiz.querySelectorAll(".rc-ctx select");
    assert.equal(curso.options[0].textContent, "Matemáticas · 2.º ESO");
    assert.deepEqual([...tema.options].map((o) => o.value), ["ecuaciones-primer-grado", "funciones"]);
    assert.equal(boton(m.raiz, "PDF").disabled, true, "sin hoja no hay PDF");
    tema.value = "funciones";
    boton(m.raiz, "Escribir la hoja").click();
    await tick(); await tick();
    assert.equal(m.llamadas.generar[0].tema, "funciones");
    assert.equal(m.llamadas.generar[0].actividades, 6);
    assert.equal(m.llamadas.generar[0].dificultad, undefined, "dificultad variada: no se manda");
    assert.equal(m.llamadas.pintadas[0].centro, "IES de prueba");
    const tags = [...m.raiz.querySelectorAll(".rc-ia__ej .rc-tag")].map((t) => t.textContent);
    assert.deepEqual(tags, ["Solución comprobada", "Sin verificar: revísala"]);
    assert.match(m.raiz.querySelector('[role="status"]').textContent, /1 sin verificar.*descartado 1/);
    assert.equal(m.raiz.querySelectorAll(".rc-ia__sol")[0].textContent.includes("x = 7"), true, "la solución, para el profesor");
    boton(m.raiz, "PDF").click();
    await tick();
    assert.equal(m.llamadas.pdf, 1);
  });

  test("si la IA falla, se dice y se puede volver a pedir", async () => {
    const m = montar({ falla: true });
    await m.pantalla.render(m.raiz);
    boton(m.raiz, "Escribir la hoja").click();
    await tick(); await tick();
    assert.match(m.raiz.querySelector('[role="status"]').textContent, /no ha respondido/);
    assert.equal(boton(m.raiz, "Escribir la hoja").disabled, false);
  });

  test("sin cursos con referencias, lo dice y no deja pedir", async () => {
    const m = montar({ cursos: [] });
    await m.pantalla.render(m.raiz);
    assert.match(m.raiz.textContent, /Todavía no hay temas/);
    assert.equal(boton(m.raiz, "Escribir la hoja").disabled, true);
  });
}
