// CÓMO SE ESCRIBEN LAS CANTIDADES de este tema: euros con céntimos, decimales
// con coma y porcentajes.
//
// EL DINERO VA EN CÉNTIMOS ENTEROS por dentro (2,40 € es 240): así la
// aritmética es exacta y no aparece nunca un 2,4000000001 de la coma
// flotante de JavaScript. Solo al escribirlo se pasa a euros.
//
// Todo se escribe en TEXTO, fuera de los $: el € y el % dentro de KaTeX
// necesitan escaparse y no aportan nada que el texto no dé.

// 240 → "2,40 €"; 300 → "3 €". Con céntimos, siempre dos cifras (2,40 y no
// 2,4), que es como se escribe un precio.
export function euros(centimos) {
  return `${cantidadDeDinero(centimos)} €`;
}

// La cantidad sin el símbolo, para otras monedas: 120 → "1,20".
export function cantidadDeDinero(centimos) {
  const e = Math.floor(centimos / 100);
  const c = centimos % 100;
  return c ? `${e},${String(c).padStart(2, "0")}` : String(e);
}

// Un decimal exacto con coma: 0.25 → "0,25", 1.5 → "1,5", 3 → "3". Solo
// para números que tienen como mucho tres decimales exactos (los de este
// tema): se redondea a tres para quitar el ruido de la coma flotante.
export function conComa(x) {
  return String(Number(x.toFixed(3))).replace(".", ",");
}

// n de cada 100, como decimal exacto (la forma de escribir un porcentaje).
export const decimalDePorcentaje = (p) => conComa(p / 100);
