import { el, boton } from "../elementos.js";
import { criteriosDe, pesosIguales, sumaDePesos } from "../../../../shared/programacion/estructuraDeLaProgramacion.js";
import { cuadroDeTexto } from "./pasoTextos.js";

// PASO 3: EVALUACIÓN. Los apartados c) (procedimientos e instrumentos),
// d) (criterios de calificación) y e) (evaluación inicial).
//
// d) se hace como tabla: cuánto pesa cada competencia específica en la
// nota (en %). Es la forma habitual en Aragón desde la LOMLOE: la nota sale
// de los criterios, agrupados por su competencia. Tiene que sumar 100.
export function pintarPasoEvaluacion({ contenedor, curriculo, datos, onCambio, doc = document }) {
  const competencias = (curriculo?.competencias || []).filter((ce) => ce.criterios.length);
  if (!datos.pesos || !Object.keys(datos.pesos).length) datos.pesos = pesosIguales(curriculo);
  const porCe = new Map();
  for (const k of criteriosDe(curriculo)) porCe.set(k.competencia, (porCe.get(k.competencia) || 0) + 1);

  const tabla = el(doc, "div", "rc-card rc-pg__pesos");
  tabla.append(
    el(doc, "span", "rc-pg__letra", "d)"),
    el(doc, "span", "rc-pg__titulo", "Criterios de calificación."),
    el(doc, "p", "rc-sub", "Peso de cada competencia específica en la nota. Dentro de cada una, sus criterios pesan igual salvo que lo expliques en c)."),
  );
  const suma = el(doc, "p", "rc-ban");
  const pintarSuma = () => {
    const s = sumaDePesos(datos.pesos);
    suma.className = s === 100 ? "rc-ban rc-ban--ok" : "rc-ban";
    suma.textContent = s === 100 ? "Suma 100 %." : `Suma ${s} %: tiene que sumar 100.`;
  };
  for (const ce of competencias) {
    const fila = el(doc, "label", "rc-pg__peso");
    const n = el(doc, "input", "rc-sel rc-pg__num");
    n.type = "number";
    n.min = "0";
    n.max = "100";
    n.value = String(datos.pesos[ce.codigo] ?? 0);
    n.setAttribute("aria-label", `Peso de ${ce.codigo}`);
    n.addEventListener("input", () => {
      datos.pesos[ce.codigo] = Math.min(100, Math.max(0, Number(n.value) || 0));
      pintarSuma();
      onCambio();
    });
    fila.append(el(doc, "b", "rc-cur__codigo", ce.codigo), el(doc, "span", "rc-pg__ce", ce.texto || ""), el(doc, "span", "rc-sub", `${porCe.get(ce.codigo) || 0} criterios`), n, el(doc, "span", "", "%"));
    tabla.appendChild(fila);
  }
  tabla.append(suma, boton(doc, "Repartir a partes iguales", {
    clase: "rc-btn--sm",
    onClick: () => { datos.pesos = pesosIguales(curriculo); pintarPasoEvaluacion({ contenedor, curriculo, datos, onCambio, doc }); onCambio(); },
  }));
  pintarSuma();

  contenedor.replaceChildren(
    cuadroDeTexto({ letra: "c", datos, onCambio, doc }),
    tabla,
    cuadroDeTexto({ letra: "e", datos, onCambio, doc }),
  );
}
