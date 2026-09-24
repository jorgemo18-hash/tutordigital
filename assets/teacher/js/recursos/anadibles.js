// QUÉ SE PUEDE AÑADIR A LA HOJA Y CUÁL TOCA "AL AZAR".
//
// Las baterías que se pueden añadir son las del objetivo y las de sus
// anteriores (el repaso), como al montar; del más alto al más bajo, cada una
// con el título de su objetivo para agruparlas en "Elegir del catálogo".
export function bateriasAnadibles(tema, objetivo) {
  return (tema?.objetivos || [])
    .filter((o) => o.numero <= objetivo)
    .sort((x, y) => y.numero - x.numero)
    .flatMap((o) => o.baterias.map((b) => ({ ...b, objetivo: o.numero, tituloObjetivo: o.titulo })));
}

// Al azar, pero primero un tipo que aún no esté en la hoja; si ya están
// todos, uno cualquiera. `azar` se inyecta en los tests.
export function claveAlAzar({ huecos, candidatas, azar = Math.random }) {
  const deLaHoja = new Set((huecos || []).map((h) => h.clave));
  const nuevas = candidatas.filter((b) => !deLaHoja.has(b.clave));
  const entre = nuevas.length ? nuevas : candidatas;
  return entre[Math.floor(azar() * entre.length)]?.clave;
}
