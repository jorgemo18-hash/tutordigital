// CÓMO SE NOMBRAN LAS FRACCIONES en las explicaciones: "un tercio",
// "tres cuartos". Aparte de los generadores porque lo usan varios.

// Cómo se llama una parte: medio, tercio, cuarto… y a partir de 11, "onceavo".
const PARTES = { 2: ["medio", "medios"], 3: ["tercio", "tercios"], 4: ["cuarto", "cuartos"], 5: ["quinto", "quintos"],
  6: ["sexto", "sextos"], 7: ["séptimo", "séptimos"], 8: ["octavo", "octavos"], 9: ["noveno", "novenos"],
  10: ["décimo", "décimos"], 11: ["onceavo", "onceavos"], 12: ["doceavo", "doceavos"] };
export function nombreDeParte(d, plural = false) {
  return PARTES[d]?.[plural ? 1 : 0] || (plural ? `partes de ${d}` : `parte de ${d}`);
}


// "los 3/8" y, si el numerador es 1, "un octavo" o "la mitad": "los 1/8" no
// se dice.
export function losDe({ n, d }) {
  if (n !== 1) return `los ${n}/${d}`;
  return d === 2 ? "la mitad" : `un ${nombreDeParte(d)}`;
}
