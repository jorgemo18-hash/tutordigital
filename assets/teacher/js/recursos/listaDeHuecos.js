import { resumenDeActividad } from "../../../shared/generador/resumenDeActividad.js";
import { el, boton, etiqueta, dificultad } from "./elementos.js";

// LA LISTA DE EJERCICIOS DE LA HOJA, uno por fila: número, qué pide, tipo,
// dificultad, concepto, y Cambiar / Quitar. Es la columna izquierda del
// diseño de Claude Design.
//
// DIFERENCIA CON EL DISEÑO: allí la hoja tenía cinco huecos fijos. Aquí
// tiene los que den la intensidad y lo pedido (el montador reparte en
// folios), así que el título dice cuántos hay y no hay "Añadir ejercicio":
// para más, se pide un número en "Ejercicios" o intensidad Refuerzo.
//
// Sin números calculados sobre alumnos (principio del diseño): todo lo que
// se pinta sale del catálogo o de la hoja misma.
function fila(doc, { actividad, hueco, orden, cambiando, puedeQuitar, onCambiar, onQuitar }) {
  const r = resumenDeActividad(actividad);
  const slot = el(doc, "div", `rc-slot${cambiando ? " is-hl" : ""}`);
  slot.dataset.orden = String(orden);

  const cuerpo = el(doc, "div", "rc-slot__cuerpo");
  cuerpo.appendChild(el(doc, "p", "rc-slot__en", r.enunciado));
  if (r.muestra) cuerpo.appendChild(el(doc, "p", "rc-slot__muestra", r.muestra));

  const meta = el(doc, "div", "rc-slot__meta");
  const problema = actividad?.tipo === "problema";
  meta.appendChild(etiqueta(doc, problema ? "Problema" : "Ejercicio", problema ? "rc-tag--probl" : "rc-tag--ejerc"));
  if (hueco?.dificultad) meta.appendChild(dificultad(doc, hueco.dificultad));
  if (hueco?.concepto) meta.appendChild(etiqueta(doc, hueco.concepto));
  if (hueco?.esRepaso) meta.appendChild(etiqueta(doc, `Repaso · objetivo ${hueco.objetivo}`, "rc-tag--repaso"));
  if (cambiando) meta.appendChild(etiqueta(doc, "Cambiando este", "rc-tag--cu"));
  cuerpo.appendChild(meta);

  const acciones = el(doc, "div", "rc-slot__act");
  if (!cambiando) acciones.appendChild(boton(doc, "Cambiar", { clase: "rc-btn--sm", onClick: () => onCambiar(orden) }));
  const quitar = boton(doc, "Quitar", {
    clase: "rc-btn--sm rc-btn--gh",
    onClick: () => onQuitar(orden),
    titulo: puedeQuitar ? "" : "Una hoja necesita al menos un ejercicio",
  });
  quitar.disabled = !puedeQuitar;
  acciones.appendChild(quitar);

  slot.append(el(doc, "div", "rc-slot__n", String(orden)), cuerpo, acciones);
  return slot;
}

export function conceptosDistintos(huecos) {
  return new Set((huecos || []).map((h) => h.concepto).filter(Boolean)).size;
}

export function pintarListaDeHuecos({ contenedor, hoja, huecos, cambiando = null, onCambiar, onQuitar, doc = document }) {
  const n = huecos.length;
  const cabecera = el(doc, "div", "rc-chd");
  const conceptos = conceptosDistintos(huecos);
  cabecera.append(
    el(doc, "h2", "", n === 1 ? "1 ejercicio en la hoja" : `${n} ejercicios en la hoja`),
    el(doc, "span", "rc-k", conceptos === 1 ? "1 concepto" : `${conceptos} conceptos`),
    el(doc, "span", "rc-sp"),
    el(doc, "span", "rc-sub", cambiando ? `Cambiando el ${cambiando}` : "Cada ejercicio se cambia por separado"),
  );
  const lista = el(doc, "div", "rc-slots");
  huecos.forEach((hueco, i) => {
    lista.appendChild(fila(doc, {
      actividad: hoja.actividades[i],
      hueco,
      orden: i + 1,
      cambiando: cambiando === i + 1,
      puedeQuitar: n > 1,
      onCambiar,
      onQuitar,
    }));
  });
  contenedor.replaceChildren(cabecera, lista);
}
