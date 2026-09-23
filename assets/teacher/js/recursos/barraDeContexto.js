import { buildSelectoresDeTema } from "../../../shared/generador/selectoresDeTema.js";
import { el, boton, campo, selector } from "./elementos.js";

// LA BARRA DE CONTEXTO DE LA HOJA: curso, materia, tema, objetivo,
// intensidad y cuántos ejercicios; y "Volver a montar".
//
// Como en la academia, cambiar cualquier cosa monta la hoja al momento: no
// hay un botón "Generar" que olvidar pulsar. "Volver a montar" es lo mismo
// con otros números.
// "Todo el tema": uno de cada objetivo (Jorge, 23/9; ver hojaDelTema.js en
// el servidor). Va como una opción más del objetivo, la primera.
export const TODO_EL_TEMA = "tema";

export const INTENSIDADES = [
  ["repaso", "Repaso"],
  ["normal", "Normal"],
  ["refuerzo", "Refuerzo"],
];

export function buildBarraDeContexto({ catalogo, inicial, onCambio, onVolverAMontar, doc = document }) {
  let estado = { ...inicial };
  const temaActual = () => catalogo.temas.find((t) => t.id === estado.temaId) || catalogo.temas[0];
  const objetivoActual = () => temaActual().objetivos.find((o) => o.numero === estado.objetivo);

  const wrap = el(doc, "div", "rc-card rc-ctx");

  const temas = buildSelectoresDeTema({
    temas: catalogo.temas,
    temaId: estado.temaId,
    clase: "rc-sel",
    doc,
    onCambio: (t) => {
      estado = { ...estado, temaId: t.id, todoElTema: false };
      pintarObjetivos();
      pintarCuantos();
      avisar();
    },
  });

  const objetivo = selector(doc, [], null);
  function pintarObjetivos() {
    const lista = temaActual().objetivos;
    if (!lista.some((o) => o.numero === estado.objetivo)) estado = { ...estado, objetivo: lista[0].numero };
    const todo = el(doc, "option", "", "Todo el tema (uno de cada objetivo)");
    todo.value = TODO_EL_TEMA;
    objetivo.replaceChildren(todo, ...lista.map((o) => {
      const op = el(doc, "option", "", `${o.numero}. ${o.titulo}`);
      op.value = String(o.numero);
      return op;
    }));
    objetivo.value = estado.todoElTema ? TODO_EL_TEMA : String(estado.objetivo);
  }

  const intensidad = selector(doc, INTENSIDADES, estado.intensidad);

  // Automático = lo que quepa en los folios de la intensidad. Solo se
  // ofrecen los números que el objetivo puede dar.
  const cuantos = selector(doc, [], null);
  function pintarCuantos() {
    // En "todo el tema" son tantos como objetivos: no se elige.
    cuantos.disabled = Boolean(estado.todoElTema);
    const max = objetivoActual()?.maxActividades || 1;
    if (estado.actividades && estado.actividades > max) estado = { ...estado, actividades: null };
    const opciones = [["", "Automático"]];
    for (let n = 1; n <= max; n += 1) opciones.push([String(n), String(n)]);
    cuantos.replaceChildren(...opciones.map(([v, t]) => {
      const op = el(doc, "option", "", t);
      op.value = v;
      return op;
    }));
    cuantos.value = estado.actividades ? String(estado.actividades) : "";
  }

  function avisar() {
    onCambio({ ...estado });
  }

  objetivo.addEventListener("change", () => {
    // Con "todo el tema", `objetivo` pasa a ser el último del tema: es el
    // que manda al añadir ejercicios o pedirlos con palabras (ese y sus
    // anteriores = todo el tema).
    const lista = temaActual().objetivos;
    estado = objetivo.value === TODO_EL_TEMA
      ? { ...estado, todoElTema: true, objetivo: lista[lista.length - 1].numero, actividades: null }
      : { ...estado, todoElTema: false, objetivo: Number(objetivo.value) };
    pintarCuantos();
    avisar();
  });
  intensidad.addEventListener("change", () => { estado = { ...estado, intensidad: intensidad.value }; avisar(); });
  cuantos.addEventListener("change", () => {
    estado = { ...estado, actividades: cuantos.value ? Number(cuantos.value) : null };
    avisar();
  });

  const volver = boton(doc, "Volver a montar", {
    titulo: "La misma hoja con otros números",
    onClick: () => onVolverAMontar({ ...estado }),
  });

  pintarObjetivos();
  pintarCuantos();
  wrap.append(
    campo(doc, "Curso", temas.curso, "rc-fld--curso"),
    campo(doc, "Materia", temas.materia, "rc-fld--materia"),
    campo(doc, "Tema", temas.tema, "rc-fld--tema"),
    campo(doc, "Objetivo", objetivo, "rc-fld--objetivo"),
    campo(doc, "Intensidad", intensidad, "rc-fld--intensidad"),
    campo(doc, "Ejercicios", cuantos, "rc-fld--cuantos"),
    el(doc, "span", "rc-ctx__sep"),
    volver,
  );

  const controles = [...temas.controles, objetivo, intensidad, cuantos, volver];
  return {
    el: wrap,
    get estado() { return { ...estado }; },
    setOcupado(si) {
      for (const c of controles) c.disabled = si;
      if (!si) cuantos.disabled = Boolean(estado.todoElTema);
    },
  };
}
