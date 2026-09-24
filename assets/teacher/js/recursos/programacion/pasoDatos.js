import { el, campo, selector } from "../elementos.js";

// PASO 1: DATOS. Título, sección (si la materia tiene varias en el curso:
// Matemáticas A y B en 4.º), y horas: sesiones por semana (del anexo III,
// se puede cambiar si el centro da más) y semanas lectivas (35 por defecto,
// las del calendario escolar de Aragón aproximadas).
export const SEMANAS_POR_DEFECTO = 35;

export function sesionesDelCurso(datos) {
  return (Number(datos.sesionesSemanales) || 0) * (Number(datos.semanas) || SEMANAS_POR_DEFECTO);
}

export function pintarPasoDatos({ contenedor, cabecera, datos, variantes, sesionesOficiales, onCambio, onVariante, doc = document }) {
  const tarjeta = el(doc, "div", "rc-card rc-pg__datos");

  const titulo = el(doc, "input", "rc-sel");
  titulo.value = cabecera.titulo || "";
  titulo.placeholder = "Ej.: Programación de Matemáticas 1.º ESO, curso 2026-27";
  titulo.addEventListener("input", () => { cabecera.titulo = titulo.value; onCambio(); });
  tarjeta.appendChild(campo(doc, "Título", titulo, "rc-fld--ancho"));

  if (variantes.length > 1) {
    const v = selector(doc, variantes.map((x) => [x, x]), datos.variante || variantes[0]);
    v.addEventListener("change", () => { datos.variante = v.value; onVariante(); });
    tarjeta.appendChild(campo(doc, "Sección del currículo", v, "rc-fld--ancho"));
  }

  const ses = el(doc, "input", "rc-sel rc-pg__num");
  ses.type = "number";
  ses.min = "0";
  ses.max = "20";
  ses.value = String(datos.sesionesSemanales ?? "");
  const sem = el(doc, "input", "rc-sel rc-pg__num");
  sem.type = "number";
  sem.min = "1";
  sem.max = "45";
  sem.value = String(datos.semanas || SEMANAS_POR_DEFECTO);
  const total = el(doc, "p", "rc-sub");
  const pintarTotal = () => {
    const n = sesionesDelCurso(datos);
    total.textContent = n ? `Unas ${n} sesiones en el curso.` : "Pon las sesiones semanales para calcular las del curso.";
  };
  ses.addEventListener("input", () => { datos.sesionesSemanales = Math.min(20, Math.max(0, Number(ses.value) || 0)); pintarTotal(); onCambio(); });
  sem.addEventListener("input", () => { datos.semanas = Math.min(45, Math.max(1, Number(sem.value) || SEMANAS_POR_DEFECTO)); pintarTotal(); onCambio(); });
  const horas = el(doc, "div", "rc-pg__horas");
  horas.append(campo(doc, "Sesiones por semana", ses), campo(doc, "Semanas lectivas", sem));
  tarjeta.append(horas, total);
  if (sesionesOficiales) tarjeta.appendChild(el(doc, "p", "rc-sub", `Horario mínimo del anexo III de la Orden: ${sesionesOficiales} sesiones semanales.`));
  pintarTotal();
  contenedor.replaceChildren(tarjeta);
}
