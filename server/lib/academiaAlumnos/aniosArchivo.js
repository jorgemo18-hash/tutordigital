// Los años en que se archivó a alguien, para poder filtrar la pestaña
// "Archivados" por año.
//
// POR QUÉ. Archivados es la única pestaña que solo crece: cada curso deja
// ahí a los que se fueron, y nunca se vacía. Con 10 alumnos archivados da
// igual, pero a cinco cursos vista son cientos en una lista paginada de 30
// en 30, y el año de la baja es justo el dato con el que uno los recuerda
// ("la niña que dejó en 2028"). Es un filtro, no un orden: recorta la lista
// en vez de reordenarla, que es lo que hace que encontrar sea rápido.
//
// El año es el de `fecha_baja`, que es lo que distingue a un archivado de un
// borrador (ver estado.js): un borrador tiene activo=false y fecha_baja
// NULL, así que aquí nunca entra.

// Acota una query de PostgREST al año pedido. Sobre fecha_baja, que es una
// columna `date`: se comparan cadenas YMD y no hace falta extract().
export function aplicarFiltroAnioBaja(query, anio) {
  const n = Number(anio);
  if (!Number.isInteger(n)) return query;
  return query.gte("fecha_baja", `${n}-01-01`).lte("fecha_baja", `${n}-12-31`);
}

// De una lista de filas con fecha_baja a [{ anio, total }], del más reciente
// al más antiguo. El total va incluido porque un chip que dice "2028 · 14"
// informa de algo antes de pulsarlo; sin el número hay que entrar a ver si
// ese año tiene uno o cuarenta.
export function aniosDeArchivo(filas = []) {
  const porAnio = new Map();
  for (const fila of filas || []) {
    const anio = Number(String(fila?.fecha_baja || "").slice(0, 4));
    if (!Number.isInteger(anio) || anio < 1900) continue;
    porAnio.set(anio, (porAnio.get(anio) || 0) + 1);
  }
  return [...porAnio.entries()]
    .map(([anio, total]) => ({ anio, total }))
    .sort((a, b) => b.anio - a.anio);
}

// Los años disponibles para el centro. Se piden TODAS las fecha_baja y se
// agrupan aquí, en vez de con un GROUP BY: PostgREST no agrupa sin una RPC,
// y una columna `date` de unos cientos de filas es una consulta trivial.
//
// El día en que una academia tenga miles de archivados esto pasa a ser una
// RPC — y se notará, porque el número de filas leídas aquí crece con el
// histórico completo, no con la página que se está viendo. Queda dicho.
export async function consultarAniosArchivo(admin, tenantId) {
  const { data, error } = await admin
    .from("academia_alumnos")
    .select("fecha_baja")
    .eq("tenant_id", tenantId)
    .eq("activo", false)
    .not("fecha_baja", "is", null);
  if (error) return { error };
  return { anios: aniosDeArchivo(data || []) };
}
