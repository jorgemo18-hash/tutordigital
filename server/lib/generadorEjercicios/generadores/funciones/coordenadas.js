import { reuneApartados } from "../../ejercicio.js";
import { escribe, par } from "./escritura.js";

// FUNCIONES, OBJETIVO 1: COORDENADAS CARTESIANAS (concepto 1). Saber D.5:
// «Relaciones lineales: identificación y comparación de diferentes modos de
// representación, tablas, gráficas…». Leer un punto es lo que hace falta
// antes de leer cualquier gráfica.
//
// Los ejes los dibuja la hoja (figuras/ejes.js) con cuadrícula de 5 mm: el
// alumno cuenta cuadros.
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   1 escribir las coordenadas al revés, (y, x);
//   2 equivocarse de cuadrante por los signos (el 2.º con el 4.º).

const LETRAS = ["A", "B", "C", "D", "E"];

// Tres puntos, cada uno en un cuadrante distinto, con x ≠ y y ninguno
// repetido (al revés, (2, 3) y (3, 2) serían el mismo error y la trampa
// no se distinguiría).
function puntosAlAzar(azar, cuantos) {
  const signos = azar.mezcla([[1, 1], [-1, 1], [-1, -1], [1, -1]]);
  const puntos = [];
  for (let i = 0; i < cuantos; i += 1) {
    const [sx, sy] = signos[i % 4];
    // Dentro de la cuadrícula, no en su borde: un punto en la esquina tiene
    // la letra fuera y parece que no pertenece a los ejes.
    const x = sx * azar.entero(1, 3);
    const y = sy * azar.entero(1, 2);
    if (Math.abs(x) === Math.abs(y) || puntos.some((p) => p.x === x && p.y === y)) return null;
    puntos.push({ x, y, etiqueta: LETRAS[i] });
  }
  return puntos;
}

// ── "Escribe las coordenadas" (dificultad 1) ────────────────────────────
// De 2 a 3 cuadrículas pequeñas (de −4 a 4 y de −3 a 3) con tres puntos
// cada una, en tres columnas: con cuadrículas grandes de cuatro puntos, la
// actividad ocupaba medio folio.
export function leeCoordenadas(azar, { cuantos = 2 } = {}) {
  const { apartados } = reuneApartados(() => {
    const puntos = puntosAlAzar(azar, 3);
    if (!puntos) return null;
    // Espacios duros dentro de cada «A = ___»: si la línea no cabe, parte
    // entre un punto y el siguiente, nunca entre la letra y su hueco.
    const huecos = puntos.map((p) => `${p.etiqueta}\u00a0=\u00a0___`).join("  ");
    return {
      latex: huecos,
      latexResuelto: puntos.map((p) => `${p.etiqueta} = ${par(p.x, p.y)}`).join("   "),
      texto: puntos.map((p) => `${p.etiqueta}${par(p.x, p.y)}`).join(" ") + " → ___",
      solucion: puntos.map((p) => par(p.x, p.y)),
      alReves: puntos.map((p) => par(p.y, p.x)),
      figura: { tipo: "ejes", x: [-4, 4], y: [-3, 3], puntos, descripcion: "Ejes de coordenadas con tres puntos" },
      razon: "Primero la x (cuántos cuadros a la derecha o a la izquierda del eje vertical) y después la y (arriba o abajo del horizontal).",
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "lee_coordenadas",
    arquetipo: "Escribe las coordenadas de los puntos",
    enunciado: "Escribe las coordenadas (x, y) de cada punto:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 3,
    apartados,
  };
}

const CUADRANTE = (x, y) => (x > 0 && y > 0 ? "1.º" : x < 0 && y > 0 ? "2.º" : x < 0 && y < 0 ? "3.º" : "4.º");

// ── "¿En qué cuadrante está?" (dificultad 1) ────────────────────────────
// De 6 a 8 puntos sin dibujo: la mitad en los cuadrantes que se confunden
// (2.º y 4.º) y alguno sobre un eje, que no está en ningún cuadrante.
export function cuadrante(azar, { cuantos = 6 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const enEje = i % 5 === 4;
    i += 1;
    let x = azar.entero(1, 9) * (azar.suerte(0.5) ? -1 : 1);
    let y = azar.entero(1, 9) * (azar.suerte(0.5) ? -1 : 1);
    if (enEje) { if (azar.suerte(0.5)) x = 0; else y = 0; }
    if (!enEje && Math.abs(x) === Math.abs(y)) return null;
    const sol = x === 0 ? "eje Y" : y === 0 ? "eje X" : CUADRANTE(x, y);
    return {
      latex: `${par(x, y)}: ___`,
      latexResuelto: `${par(x, y)}: ${sol}`,
      texto: `${par(x, y)}: ___`,
      solucion: sol,
      // Error 2: los signos leídos al revés (la y como si fuera la x).
      alReves: x !== 0 && y !== 0 ? CUADRANTE(y, x) : null,
      razon: x === 0 ? "La x es 0: está sobre el eje vertical (eje Y), en ningún cuadrante."
        : y === 0 ? "La y es 0: está sobre el eje horizontal (eje X), en ningún cuadrante."
          : `x ${x > 0 ? "positiva (derecha)" : "negativa (izquierda)"} e y ${y > 0 ? "positiva (arriba)" : "negativa (abajo)"}: ${sol} cuadrante.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "cuadrante",
    arquetipo: "Di en qué cuadrante está el punto",
    enunciado: "¿En qué cuadrante está? (1.º, 2.º, 3.º, 4.º, o sobre un eje)",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}
