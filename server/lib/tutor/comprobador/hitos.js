// LA LISTA DE HITOS CON ✓ / ✗ QUE VE EL ALUMNO AL ENVIAR (2/10/2026).
//
// Con las líneas ya comprobadas (lineas.js) y el método del tipo de
// ejercicio (tutor/metodos/), dice para cada hito:
//   - "hecho": alguna línea buena, ANTES del primer error, llega a su forma
//     (o a la de un hito posterior: quien despeja de golpe no repite nada);
//   - "mal": el primer hito sin hacer cuando hay una línea mal; la lista se
//     para aquí;
//   - "pendiente": después del error, o aún no ha llegado;
//   - "sin_decidir": su forma no la decide el código (la valora el tutor).
// Y en `dudosas`, las líneas que no se entendieron antes del error: salen
// con «?» y se preguntan; nunca se pone un ✓ a algo que no se ha leído.
//
// `errorProbable`: si la solución a la que lleva la línea mal coincide con
// la de una respuesta-trampa del catálogo (los generadores la calculan), ese
// es el error. Si no coincide pero la línea tiene la forma correcta del hito
// (la estructura bien, los números mal), lo más probable es una cuenta.
import { cumpleForma, esDecidible } from "./formas.js";

export function hitosDelEnvio({ metodo, comprobacion, tipo, trampas = [] }) {
  const { lineas, primeraMal } = comprobacion;
  const validas = lineas.slice(0, primeraMal ?? lineas.length).filter((l) => l.leida && l.equivalente === true);
  const formas = metodo.hitos.map((h) => h.termina);

  const alcanzadoHasta = formas.reduce((ultimo, forma, i) => (
    validas.some((l) => cumpleForma(forma, l, tipo) === true) ? i : ultimo
  ), -1);

  let parado = false;
  const hitos = metodo.hitos.map((h, i) => {
    if (i <= alcanzadoHasta) return { id: h.id, estado: "hecho" };
    if (parado) return { id: h.id, estado: "pendiente" };
    if (primeraMal != null) { parado = true; return { id: h.id, estado: "mal", linea: primeraMal }; }
    return { id: h.id, estado: esDecidible(h.termina, tipo) ? "pendiente" : "sin_decidir" };
  });

  const dudosas = lineas.slice(0, primeraMal ?? lineas.length).map((l, i) => (l.leida ? null : i)).filter((i) => i !== null);
  return { hitos, dudosas, errorProbable: primeraMal == null ? null : errorProbable({ linea: lineas[primeraMal], hitos, metodo, tipo, trampas }) };
}

function errorProbable({ linea, hitos, metodo, tipo, trampas }) {
  const t = trampas.find((x) => typeof linea.solucion === "number" && Math.abs(x.solucion - linea.solucion) < 1e-9);
  if (t) return { error: t.error, motivo: "coincide con la respuesta-trampa" };
  const hito = metodo.hitos.find((h) => h.id === hitos.find((x) => x.estado === "mal")?.id);
  if (hito && cumpleForma(hito.termina, linea, tipo) === true) return { error: null, motivo: "forma bien, cuenta mal" };
  return null;
}
