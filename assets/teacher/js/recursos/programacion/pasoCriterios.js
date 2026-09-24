import { el, boton } from "../elementos.js";
import { criteriosDe } from "../../../../shared/programacion/estructuraDeLaProgramacion.js";
import {
  INSTRUMENTOS, SIGLAS, fichaDeCriterio, pesoDeCriterio, ponFicha, criteriosSinInstrumento,
} from "../../../../shared/programacion/detalleDeCriterios.js";

// EN EL PASO "EVALUACIÓN": con qué se evalúa cada criterio y cuáles son
// aprendizajes imprescindibles. Una fila por criterio: su peso (el que sale
// del apartado d), los instrumentos como botones de sigla y la casilla de
// imprescindible. Con esto, el documento pinta en cada unidad la tabla que
// traen las programaciones reales (ver detalleDeCriterios.js).
function botonDeInstrumento(doc, { sigla, activo, onCambio }) {
  const b = el(doc, "button", `rc-pg__sigla${activo ? " is-on" : ""}`, sigla);
  b.type = "button";
  b.title = INSTRUMENTOS[sigla];
  b.setAttribute("aria-pressed", String(activo));
  b.addEventListener("click", () => {
    const on = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", String(on));
    b.classList.toggle("is-on", on);
    onCambio(on);
  });
  return b;
}

function filaDeCriterio(doc, { k, curriculo, datos, alCambiar }) {
  const ficha = fichaDeCriterio(datos, k.codigo);
  const fila = el(doc, "div", "rc-pg__crit");
  fila.dataset.criterio = k.codigo;
  const siglas = el(doc, "div", "rc-pg__siglas");
  for (const sigla of SIGLAS) {
    siglas.appendChild(botonDeInstrumento(doc, {
      sigla,
      activo: ficha.instrumentos.includes(sigla),
      onCambio: (on) => {
        const actuales = fichaDeCriterio(datos, k.codigo).instrumentos;
        ponFicha(datos, k.codigo, { instrumentos: on ? [...actuales, sigla] : actuales.filter((s) => s !== sigla) });
        alCambiar();
      },
    }));
  }
  const impr = el(doc, "label", "rc-pg__impr");
  const caja = el(doc, "input");
  caja.type = "checkbox";
  caja.checked = ficha.imprescindible;
  caja.addEventListener("change", () => { ponFicha(datos, k.codigo, { imprescindible: caja.checked }); alCambiar(); });
  impr.append(caja, el(doc, "span", "", "Imprescindible"));
  fila.append(
    el(doc, "b", "rc-cur__codigo", k.codigo),
    el(doc, "span", "rc-pg__ce", k.texto),
    el(doc, "span", "rc-pg__peso-crit", `${String(pesoDeCriterio(curriculo, datos, k.codigo)).replace(".", ",")} %`),
    siglas,
    impr,
  );
  return fila;
}

export function bloqueDeCriterios({ curriculo, datos, onCambio, repintar, doc = document }) {
  const caja = el(doc, "div", "rc-card rc-pg__criterios");
  caja.append(
    el(doc, "span", "rc-pg__titulo", "Cómo se evalúa cada criterio"),
    el(doc, "p", "rc-sub", `Instrumentos: ${SIGLAS.map((s) => `${s} ${INSTRUMENTOS[s].toLowerCase()}`).join(" · ")}. Marca también los aprendizajes imprescindibles: en el documento salen en la tabla de cada unidad.`),
  );
  const aviso = el(doc, "p", "rc-ban");
  const pintarAviso = () => {
    const faltan = criteriosSinInstrumento(curriculo, datos).length;
    aviso.className = faltan ? "rc-ban" : "rc-ban rc-ban--ok";
    aviso.textContent = faltan ? `${faltan} criterios sin instrumento.` : "Todos los criterios tienen instrumento.";
  };
  const alCambiar = () => { pintarAviso(); onCambio(); };
  caja.appendChild(boton(doc, "Prueba escrita y observación en todos los que no tengan", {
    clase: "rc-btn--sm",
    onClick: () => {
      for (const codigo of criteriosSinInstrumento(curriculo, datos)) ponFicha(datos, codigo, { instrumentos: ["PE", "OB"] });
      onCambio();
      repintar();
    },
  }));
  for (const k of criteriosDe(curriculo)) caja.appendChild(filaDeCriterio(doc, { k, curriculo, datos, alCambiar }));
  caja.appendChild(aviso);
  pintarAviso();
  return caja;
}
