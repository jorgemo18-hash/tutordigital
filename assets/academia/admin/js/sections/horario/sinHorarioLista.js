import { nivelInfo } from "../../curso.js";

// Alumnos activos sin ninguna franja asignada. Es el caso normal de un alta
// en la que todavía no se ha cuadrado el horario ("empieza en octubre"):
// sin esta lista quedan guardados y fuera de la vista, y no hay ningún sitio
// donde se vea que les falta algo.
export function buildSinHorarioLista(alumnos = []) {
  const wrap = document.createElement("div");
  wrap.className = "ach-pendientes";

  const head = document.createElement("div");
  head.className = "ach-pendientes-head";
  head.textContent = alumnos.length
    ? `Sin horario · ${alumnos.length}`
    : "Sin horario";
  wrap.appendChild(head);

  if (!alumnos.length) {
    const vacio = document.createElement("p");
    vacio.className = "ach-pendientes-vacio";
    vacio.textContent = "Todos los alumnos activos tienen horario asignado.";
    wrap.appendChild(vacio);
    return wrap;
  }

  const lista = document.createElement("div");
  lista.className = "ach-pendientes-lista";
  for (const a of alumnos) {
    const item = document.createElement("div");
    item.className = "ach-alumno";
    item.classList.add(`ach-lv-${nivelInfo(a.nivel).cls}`);
    const nombre = document.createElement("span");
    nombre.className = "ach-alumno-nombre";
    nombre.textContent = a.nombre || "—";
    item.appendChild(nombre);
    if (a.curso) {
      const curso = document.createElement("span");
      curso.className = "ach-alumno-curso";
      curso.textContent = a.curso;
      item.appendChild(curso);
    }
    lista.appendChild(item);
  }
  wrap.appendChild(lista);
  return wrap;
}
