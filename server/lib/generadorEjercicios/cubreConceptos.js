// QUÉ BATERÍAS PROPIAS ENTRAN CUANDO NO ENTRAN TODAS.
//
// DOS REGLAS, Y LA SEGUNDA SALIÓ DE MIRAR UNA HOJA.
//
// 1. EL ABANICO. La primera versión del montador cogía las últimas de la
//    lista: para una hoja de repaso del objetivo 3 elegía resta con
//    paréntesis, término que falta y cadena, y tiraba sumar dos del mismo
//    signo, que es LA BASE del objetivo. Así que se reparten las que entran
//    a lo largo de la secuencia de dificultad, cogiendo la primera y la
//    última.
//
// 2. CADA CONCEPTO DEL OBJETIVO, ANTES QUE DOS DEL MISMO. El abanico solo ve
//    posiciones en una lista, no de qué va cada batería. Al añadir las cuatro
//    de la recta numérica al objetivo 1, la hoja "normal" salía con
//    situaciones, ordenar y series —y ninguna recta— con un tercio del folio
//    libre. Jorge, el 23/9, eligió que la hoja cubra cada concepto.
//
// El resultado: primero la más fácil de cada concepto, y los huecos que
// sobran se reparten en abanico entre las demás (así sigue entrando la más
// difícil del objetivo cuando hay sitio). Si hay menos huecos que conceptos,
// el abanico se hace sobre los conceptos.
//
// La hoja respeta SIEMPRE el orden del catálogo, que es la secuencia
// pedagógica: se elige un conjunto, no un orden.

// Reparte `cuantas` posiciones a lo largo de la lista, incluyendo los dos
// extremos. Con 5 y 3 huecos: la 1.ª, la 3.ª y la 5.ª.
export function enAbanico(lista, cuantas) {
  if (cuantas <= 0) return [];
  if (cuantas >= lista.length) return [...lista];
  // Con una sola, la última: es la que más representa el objetivo.
  if (cuantas === 1) return [lista[lista.length - 1]];
  const paso = (lista.length - 1) / (cuantas - 1);
  return Array.from({ length: cuantas }, (_, i) => lista[Math.round(i * paso)]);
}

// Las baterías agrupadas por concepto, en el orden en que aparece cada uno.
// Una batería sin concepto declarado cuenta como su propio grupo aparte de
// los declarados, todas juntas: no se inventa un reparto que no está escrito.
function porConcepto(lista) {
  const grupos = new Map();
  for (const b of lista) {
    const k = b.concepto ?? "sin-concepto";
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(b);
  }
  return [...grupos.values()];
}

export function cubreConceptos(lista, cuantas) {
  if (cuantas >= lista.length) return [...lista];
  const grupos = porConcepto(lista);
  const base = enAbanico(grupos, cuantas).map((g) => g[0]);
  const resto = lista.filter((b) => !base.includes(b));
  const elegidas = new Set([...base, ...enAbanico(resto, cuantas - base.length)]);
  return lista.filter((b) => elegidas.has(b));
}
