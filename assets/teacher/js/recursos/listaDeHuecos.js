import { resumenDeActividad } from "../../../shared/generador/resumenDeActividad.js";
import { el, boton, etiqueta, dificultad } from "./elementos.js";
import { hacerOrdenable } from "./ordenarArrastrando.js";

// LA LISTA DE EJERCICIOS DE LA HOJA, uno por fila: asa para moverlo, número,
// qué tipo de ejercicio es, qué saber del currículo trabaja, tipo,
// dificultad, concepto, y Cambiar / Quitar. Debajo, "Añadir ejercicio".
// Es la columna izquierda del diseño de Claude Design.
//
// Jorge, 23/9: los números del ejercicio ya se ven en el folio, así que aquí
// no se repiten; en su lugar, *"algo más técnico"*: el saber básico con su
// texto literal del currículo (ver server/lib/generadorEjercicios/saberesBasicos.js).
//
// DIFERENCIA CON EL DISEÑO: allí la hoja tenía cinco huecos fijos. Aquí
// tiene los que den la intensidad y lo pedido, hasta `maximo`.
//
// Sin números calculados sobre alumnos (principio del diseño): todo lo que
// se pinta sale del catálogo o de la hoja misma.
//
// LOS SABERES VAN UNA VEZ, arriba de la lista, y en cada fila solo su código:
// en una hoja de un objetivo casi todos los ejercicios trabajan el mismo
// saber, y repetir la misma cita en cada fila era ruido.
export function saberesDeLaHoja(huecos) {
  const vistos = new Map();
  for (const h of huecos) {
    const s = h?.saber;
    if (!s) continue;
    const clave = `${s.codigo}|${s.vineta || ""}|${s.implicito ? 1 : 0}`;
    if (!vistos.has(clave)) vistos.set(clave, s);
  }
  return [...vistos.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
}

function bloqueDeSaberes(doc, huecos) {
  const saberes = saberesDeLaHoja(huecos);
  if (!saberes.length) return null;
  const caja = el(doc, "div", "rc-saberes");
  caja.appendChild(el(doc, "div", "rc-crumb", `Saberes básicos que trabaja · ${saberes[0].referencia || "currículo"}`));
  for (const s of saberes) {
    const p = el(doc, "p", "rc-saberes__uno");
    p.appendChild(el(doc, "b", "", `${s.codigo}${s.nombre ? ` · ${s.nombre}` : ""}`));
    if (s.vineta) p.appendChild(doc.createTextNode(` «${s.vineta}»`));
    if (s.implicito) p.appendChild(el(doc, "span", "rc-saberes__nota", " Implícito: ningún saber nombra la jerarquía de operaciones."));
    caja.appendChild(p);
  }
  return caja;
}

function fila(doc, { actividad, hueco, orden, total, cambiando, onCambiar, onQuitar, onMover }) {
  const slot = el(doc, "div", `rc-slot${cambiando ? " is-hl" : ""}`);
  slot.dataset.orden = String(orden);

  const asa = boton(doc, "", { clase: "rc-slot__asa" });
  asa.setAttribute("aria-label", `Mover el ejercicio ${orden}: arrástralo, o usa las flechas arriba y abajo`);
  asa.title = "Arrastra para cambiarlo de sitio";
  asa.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 8h14M5 12h14M5 16h14"/></svg>';
  asa.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" && orden > 1) { e.preventDefault(); onMover(orden - 1, orden - 2, { teclado: true }); }
    if (e.key === "ArrowDown" && orden < total) { e.preventDefault(); onMover(orden - 1, orden, { teclado: true }); }
  });

  const cuerpo = el(doc, "div", "rc-slot__cuerpo");
  // El nombre del tipo de ejercicio ("Suma dos enteros del mismo signo")
  // dice más que su enunciado ("Calcula:"); el enunciado ya está en el folio.
  cuerpo.appendChild(el(doc, "p", "rc-slot__en", hueco?.nombre || resumenDeActividad(actividad).enunciado));

  const meta = el(doc, "div", "rc-slot__meta");
  const problema = actividad?.tipo === "problema";
  meta.appendChild(etiqueta(doc, problema ? "Problema" : "Ejercicio", problema ? "rc-tag--probl" : "rc-tag--ejerc"));
  if (hueco?.dificultad) meta.appendChild(dificultad(doc, hueco.dificultad));
  if (hueco?.concepto) meta.appendChild(etiqueta(doc, hueco.concepto));
  if (hueco?.saber) {
    const saber = etiqueta(doc, hueco.saber.codigo, "rc-tag--saber");
    saber.title = [`${hueco.saber.codigo} ${hueco.saber.nombre || ""}`.trim(), hueco.saber.vineta].filter(Boolean).join(": ");
    meta.appendChild(saber);
  }
  if (hueco?.esRepaso) meta.appendChild(etiqueta(doc, `Repaso · objetivo ${hueco.objetivo}`, "rc-tag--repaso"));
  if (cambiando) meta.appendChild(etiqueta(doc, "Cambiando este", "rc-tag--cu"));
  cuerpo.appendChild(meta);

  const acciones = el(doc, "div", "rc-slot__act");
  if (!cambiando) acciones.appendChild(boton(doc, "Cambiar", { clase: "rc-btn--sm", onClick: () => onCambiar(orden) }));
  const quitar = boton(doc, "Quitar", {
    clase: "rc-btn--sm rc-btn--gh",
    onClick: () => onQuitar(orden),
    titulo: total > 1 ? "" : "Una hoja necesita al menos un ejercicio",
  });
  quitar.disabled = total <= 1;
  acciones.appendChild(quitar);

  slot.append(asa, el(doc, "div", "rc-slot__n", String(orden)), cuerpo, acciones);
  return slot;
}

export function conceptosDistintos(huecos) {
  return new Set(huecos.map((h) => h.concepto).filter(Boolean)).size;
}

// `enfocar`: número del ejercicio cuya asa debe quedar enfocada (tras
// moverlo con el teclado, para poder seguir moviéndolo).
export function pintarListaDeHuecos({
  contenedor, hoja, huecos, cambiando = null, maximo = Infinity, enfocar = null,
  onCambiar, onQuitar, onMover, onAnadir, doc = document,
}) {
  const n = huecos.length;
  const cabecera = el(doc, "div", "rc-chd");
  const conceptos = conceptosDistintos(huecos);
  cabecera.append(
    el(doc, "h2", "", n === 1 ? "1 ejercicio en la hoja" : `${n} ejercicios en la hoja`),
    el(doc, "span", "rc-k", conceptos === 1 ? "1 concepto" : `${conceptos} conceptos`),
    el(doc, "span", "rc-sp"),
    el(doc, "span", "rc-sub", cambiando ? `Cambiando el ${cambiando}` : "Arrastra ≡ para cambiar el orden"),
  );
  const lista = el(doc, "div", "rc-slots");
  huecos.forEach((hueco, i) => {
    lista.appendChild(fila(doc, {
      actividad: hoja.actividades[i], hueco, orden: i + 1, total: n,
      cambiando: cambiando === i + 1, onCambiar, onQuitar, onMover,
    }));
  });
  hacerOrdenable({ lista, onMover });

  const pie = el(doc, "div", "rc-lista__pie");
  const anadir = boton(doc, "+ Añadir ejercicio", { clase: "rc-btn--dash", onClick: () => onAnadir() });
  pie.appendChild(anadir);
  if (n >= maximo) {
    anadir.disabled = true;
    pie.appendChild(el(doc, "span", "rc-sub", `La hoja ya tiene ${maximo} ejercicios, el máximo. Quita uno para añadir otro.`));
  }

  contenedor.replaceChildren(...[cabecera, bloqueDeSaberes(doc, huecos), lista, pie].filter(Boolean));
  if (enfocar) lista.querySelector(`.rc-slot[data-orden="${enfocar}"] .rc-slot__asa`)?.focus();
}
