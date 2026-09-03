// La lista de precios del centro: la tabla que va debajo del horario en la
// hoja que se le da a las familias.
//
// OJO CON EL NOMBRE. En el sistema ya existe "tarifa" y es otra cosa: el
// precio que paga UN alumno concreto, con su descuento y su fecha de
// inicio, del que salen los recibos (academia_tarifas). Esto de aquí es la
// lista pública —"Primaria, 2 días a la semana: 55 €"—, que no está atada a
// ningún alumno y que cada academia se monta como quiera. Dos conceptos
// distintos, dos nombres distintos, a propósito.
//
// EL MODELO. Una tabla con las filas y las columnas que decida cada
// academia (un "+" en cada eje), y los precios en las celdas:
//
//   { columnas: [{id, titulo}], filas: [{id, titulo}], precios: {"f1|c1": "55 €"}, nota: "" }
//
// Los precios van indexados por ID de fila y columna, NO por posición. Es
// la diferencia entre poder borrar la fila del medio y que los precios se
// queden donde estaban, o que se desplacen todos una fila hacia arriba sin
// que nadie se dé cuenta hasta que una familia paga de menos.
//
// El precio se guarda como TEXTO, no como número. En una academia real la
// casilla pone "55 €", "55 €/mes", "desde 50 €" o "a consultar", y forzar
// un número obligaría a inventar reglas para todo eso. Esta tabla no
// calcula nada: se imprime.

// Los dos ejes no tienen el mismo tope, y no es un descuido. Una fila de
// más solo encoge un poco la tabla; una columna de más estrecha todas las
// casillas de precio a la vez, y a partir de seis "Bachillerato" ya no cabe
// ni encogiendo la letra — la cuartilla es de 10,5 cm. Más vale un tope que
// diga "aquí no caben" que una tabla impresa con "Ba…" en cada columna.
const MAX_COLUMNAS = 6;
const MAX_FILAS = 12;
const MAX_TEXTO = 60;
const MAX_NOTA = 240;

// Lo que ve una academia que abre la pestaña por primera vez: la tabla
// típica de una academia española, con las casillas de precio VACÍAS. Se
// rellena lo que se cobra y se borra lo que no se da — que es mucho más
// rápido que construir una tabla desde cero delante de una pantalla en
// blanco.
export function preciosPorDefecto() {
  return normalizarPrecios({
    columnas: [{ id: "c1", titulo: "Primaria" }, { id: "c2", titulo: "ESO" }, { id: "c3", titulo: "Bachillerato" }],
    filas: [
      { id: "f1", titulo: "1 día / semana" },
      { id: "f2", titulo: "2 días / semana" },
      { id: "f3", titulo: "3 días / semana" },
    ],
    precios: {},
    nota: "",
  });
}

export function clavePrecio(filaId, columnaId) {
  return `${filaId}|${columnaId}`;
}

export function precioDe(modelo, filaId, columnaId) {
  return modelo?.precios?.[clavePrecio(filaId, columnaId)] || "";
}

function textoCorto(valor, max) {
  return String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

// Un eje (filas o columnas) saneado: entradas con id y título, sin ids
// repetidos y con un tope. El tope no es capricho: la hoja es una cuartilla
// y una tabla de treinta columnas ahí no se lee — mejor cortar al guardar
// que imprimir algo ilegible.
function normalizarEje(entradas, prefijo, max) {
  const vistos = new Set();
  const eje = [];
  for (const entrada of Array.isArray(entradas) ? entradas : []) {
    if (eje.length >= max) break;
    const titulo = textoCorto(typeof entrada === "string" ? entrada : entrada?.titulo, MAX_TEXTO);
    let id = textoCorto(entrada?.id, 24);
    if (!id || vistos.has(id)) id = nuevoId(prefijo, vistos);
    vistos.add(id);
    eje.push({ id, titulo });
  }
  return eje;
}

// El siguiente id libre del eje: f1, f2, f3… Se busca el hueco en vez de
// contar cuántos hay, porque tras borrar la fila 2 el siguiente "f3" ya
// existe y reutilizar un id es exactamente lo que hace que un precio
// aparezca en la fila equivocada.
export function nuevoId(prefijo, usados) {
  const vistos = usados instanceof Set ? usados : new Set(usados || []);
  let n = 1;
  while (vistos.has(`${prefijo}${n}`)) n += 1;
  return `${prefijo}${n}`;
}

// Deja el objeto en su forma canónica, venga de la base de datos (jsonb que
// puede tener cualquier cosa dentro), del editor o de un tenant que nunca
// tocó la pestaña. Los precios huérfanos —de una fila o columna que ya se
// borró— se tiran aquí: si no, cada guardado arrastraría para siempre los
// precios de una tabla que ya no existe.
export function normalizarPrecios(raw) {
  const columnas = normalizarEje(raw?.columnas, "c", MAX_COLUMNAS);
  const filas = normalizarEje(raw?.filas, "f", MAX_FILAS);
  const validas = new Set(filas.flatMap((f) => columnas.map((c) => clavePrecio(f.id, c.id))));

  const precios = {};
  for (const [clave, valor] of Object.entries(raw?.precios || {})) {
    if (!validas.has(clave)) continue;
    const texto = textoCorto(valor, 24);
    if (texto) precios[clave] = texto;
  }

  return { columnas, filas, precios, nota: textoCorto(raw?.nota, MAX_NOTA) };
}

export function anadirFila(modelo, titulo = "") {
  const base = normalizarPrecios(modelo);
  if (base.filas.length >= MAX_FILAS) return base;
  const id = nuevoId("f", base.filas.map((f) => f.id));
  return { ...base, filas: [...base.filas, { id, titulo: textoCorto(titulo, MAX_TEXTO) }] };
}

export function anadirColumna(modelo, titulo = "") {
  const base = normalizarPrecios(modelo);
  if (base.columnas.length >= MAX_COLUMNAS) return base;
  const id = nuevoId("c", base.columnas.map((c) => c.id));
  return { ...base, columnas: [...base.columnas, { id, titulo: textoCorto(titulo, MAX_TEXTO) }] };
}

// Quitar una fila/columna tira también sus precios (vía normalizarPrecios),
// para que volver a añadir una fila no resucite los precios de la anterior.
export function quitarFila(modelo, filaId) {
  const base = normalizarPrecios(modelo);
  return normalizarPrecios({ ...base, filas: base.filas.filter((f) => f.id !== filaId) });
}

export function quitarColumna(modelo, columnaId) {
  const base = normalizarPrecios(modelo);
  return normalizarPrecios({ ...base, columnas: base.columnas.filter((c) => c.id !== columnaId) });
}

export function renombrarFila(modelo, filaId, titulo) {
  const base = normalizarPrecios(modelo);
  return { ...base, filas: base.filas.map((f) => (f.id === filaId ? { ...f, titulo: textoCorto(titulo, MAX_TEXTO) } : f)) };
}

export function renombrarColumna(modelo, columnaId, titulo) {
  const base = normalizarPrecios(modelo);
  return {
    ...base,
    columnas: base.columnas.map((c) => (c.id === columnaId ? { ...c, titulo: textoCorto(titulo, MAX_TEXTO) } : c)),
  };
}

// Poner una celda a "" la BORRA del objeto en vez de guardar una cadena
// vacía: así `precios` solo contiene lo que de verdad se cobra y la hoja
// puede distinguir "gratis/no se da" de "aún no lo he puesto".
export function conPrecio(modelo, filaId, columnaId, valor) {
  const base = normalizarPrecios(modelo);
  const precios = { ...base.precios };
  const texto = textoCorto(valor, 24);
  if (texto) precios[clavePrecio(filaId, columnaId)] = texto;
  else delete precios[clavePrecio(filaId, columnaId)];
  return { ...base, precios };
}

// ¿Hay algo que imprimir? Una tabla con las filas puestas pero sin un solo
// precio no debe salir en la hoja de familias: es peor que no poner nada.
export function hayPrecios(modelo) {
  return Object.keys(normalizarPrecios(modelo).precios).length > 0;
}

export const LIMITES_PRECIOS = { MAX_COLUMNAS, MAX_FILAS, MAX_TEXTO, MAX_NOTA };
