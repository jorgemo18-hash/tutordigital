import { el, boton } from "../elementos.js";
import {
  criteriosDe, pesosIguales, sumaDePesos, pesoPorCompetencia, modoDeCalificacion, MODOS_DE_CALIFICACION,
} from "../../../../shared/programacion/estructuraDeLaProgramacion.js";
import { cuadroDeTexto, barraDeRedactar } from "./pasoTextos.js";
import { bloqueDeCriterios } from "./pasoCriterios.js";

// PASO 3: EVALUACIÓN. Los apartados c) (procedimientos e instrumentos),
// d) (criterios de calificación) y e) (evaluación inicial).
//
// d) es una tabla de pesos (en %) que tiene que sumar 100. Cada
// departamento elige a qué nivel reparte (Jorge, 24/9: "si no lo hacen
// todos los centros igual, damos la opción"): por competencia específica
// o por criterio de evaluación. Cambiar de modo reparte de nuevo a partes
// iguales: los pesos de un modo no significan nada en el otro.
function campoDePeso(doc, { codigo, valor, onCambio }) {
  const n = el(doc, "input", "rc-sel rc-pg__num");
  n.type = "number";
  n.min = "0";
  n.max = "100";
  n.step = "0.5";
  n.value = String(valor ?? 0);
  n.setAttribute("aria-label", `Peso de ${codigo}`);
  n.addEventListener("input", () => onCambio(Math.min(100, Math.max(0, Number(n.value) || 0))));
  return n;
}

function filasPorCompetencia(doc, { tabla, curriculo, datos, alCambiar }) {
  const porCe = new Map();
  for (const k of criteriosDe(curriculo)) porCe.set(k.competencia, (porCe.get(k.competencia) || 0) + 1);
  for (const ce of (curriculo?.competencias || []).filter((x) => x.criterios.length)) {
    const fila = el(doc, "label", "rc-pg__peso");
    fila.append(
      el(doc, "b", "rc-cur__codigo", ce.codigo),
      el(doc, "span", "rc-pg__ce", ce.texto || ""),
      el(doc, "span", "rc-sub", `${porCe.get(ce.codigo) || 0} criterios`),
      campoDePeso(doc, { codigo: ce.codigo, valor: datos.pesos[ce.codigo], onCambio: (v) => { datos.pesos[ce.codigo] = v; alCambiar(); } }),
      el(doc, "span", "", "%"),
    );
    tabla.appendChild(fila);
  }
}

function filasPorCriterio(doc, { tabla, curriculo, datos, alCambiar }) {
  const subtotales = {};
  const pintaSubtotales = () => {
    const suma = pesoPorCompetencia(curriculo, datos.pesos);
    for (const [ce, nodo] of Object.entries(subtotales)) nodo.textContent = `${ce}: ${Math.round((suma[ce] || 0) * 10) / 10} %`;
  };
  for (const ce of (curriculo?.competencias || []).filter((x) => x.criterios.length)) {
    const grupo = el(doc, "div", "rc-pg__grupo-peso");
    subtotales[ce.codigo] = el(doc, "span", "rc-pg__subtotal");
    grupo.append(subtotales[ce.codigo], el(doc, "span", "rc-pg__ce", ce.texto || ""));
    tabla.appendChild(grupo);
    for (const k of ce.criterios) {
      const fila = el(doc, "label", "rc-pg__peso rc-pg__peso--criterio");
      fila.append(
        el(doc, "b", "rc-cur__codigo", k.codigo),
        el(doc, "span", "rc-pg__ce", k.texto),
        campoDePeso(doc, { codigo: k.codigo, valor: datos.pesos[k.codigo], onCambio: (v) => { datos.pesos[k.codigo] = v; pintaSubtotales(); alCambiar(); } }),
        el(doc, "span", "", "%"),
      );
      tabla.appendChild(fila);
    }
  }
  pintaSubtotales();
}

export function pintarPasoEvaluacion({ contenedor, curriculo, datos, onCambio, ia = null, doc = document }) {
  const modo = modoDeCalificacion(datos);
  if (!datos.pesos || !Object.keys(datos.pesos).length) datos.pesos = pesosIguales(curriculo, modo);
  const repintar = () => pintarPasoEvaluacion({ contenedor, curriculo, datos, onCambio, ia, doc });

  const tabla = el(doc, "div", "rc-card rc-pg__pesos");
  tabla.append(el(doc, "span", "rc-pg__letra", "d)"), el(doc, "span", "rc-pg__titulo", "Criterios de calificación."));

  const selector = el(doc, "div", "rc-subnav rc-pg__modo");
  selector.setAttribute("role", "radiogroup");
  selector.setAttribute("aria-label", "Cómo se reparte la nota");
  for (const [clave, texto] of Object.entries(MODOS_DE_CALIFICACION)) {
    const b = el(doc, "button", `rc-subnav__btn${clave === modo ? " is-on" : ""}`, texto);
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(clave === modo));
    b.dataset.modo = clave;
    b.addEventListener("click", () => {
      if (clave === modo) return;
      datos.calificacion = clave;
      datos.pesos = pesosIguales(curriculo, clave);
      onCambio();
      repintar();
    });
    selector.appendChild(b);
  }
  tabla.append(selector, el(doc, "p", "rc-sub", modo === "criterio"
    ? "Peso de cada criterio de evaluación en la nota. Junto a cada competencia, lo que suman sus criterios."
    : "Peso de cada competencia específica en la nota. Dentro de cada una, sus criterios pesan igual salvo que lo expliques en c)."));

  const suma = el(doc, "p", "rc-ban");
  const pintarSuma = () => {
    const s = Math.round(sumaDePesos(datos.pesos) * 10) / 10;
    suma.className = s === 100 ? "rc-ban rc-ban--ok" : "rc-ban";
    suma.textContent = s === 100 ? "Suma 100 %." : `Suma ${s} %: tiene que sumar 100.`;
  };
  const alCambiar = () => { pintarSuma(); onCambio(); };
  if (modo === "criterio") filasPorCriterio(doc, { tabla, curriculo, datos, alCambiar });
  else filasPorCompetencia(doc, { tabla, curriculo, datos, alCambiar });

  tabla.append(suma, boton(doc, "Repartir a partes iguales", {
    clase: "rc-btn--sm",
    onClick: () => { datos.pesos = pesosIguales(curriculo, modo); onCambio(); repintar(); },
  }));
  pintarSuma();

  contenedor.replaceChildren(
    ...(ia ? [barraDeRedactar(doc, { ia, datos, letras: ["c", "e"], onCambio, repintar })] : []),
    cuadroDeTexto({ letra: "c", datos, onCambio, doc }),
    tabla,
    bloqueDeCriterios({ curriculo, datos, onCambio, repintar, doc }),
    cuadroDeTexto({ letra: "e", datos, onCambio, doc }),
  );
}
