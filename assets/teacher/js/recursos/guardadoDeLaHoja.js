// CUÁNDO SE GUARDA LA HOJA Y QUÉ CÓDIGO LLEVA (paso 2).
//
// Se guarda al imprimir: el código va en el papel, y es la hoja impresa la
// que habrá que poner como deberes y corregir. Guardar cada vez que se
// cambia un ejercicio llenaría la lista de borradores que nadie imprimió.
//
// SI NO HA CAMBIADO, EL MISMO CÓDIGO: imprimir dos veces la misma hoja (o
// abrir una reciente y reimprimirla) no gasta otro. En cuanto se toca algo
// —cambiar, quitar, mover, añadir, montar otra— la hoja ya no es la
// guardada: el código desaparece de la vista previa y el siguiente PDF
// guarda una nueva.
//
// La "firma" es la hoja y sus huecos tal cual, sin el código ni el centro
// (que se ponen al pintar).
export function firmaDe(actual) {
  if (!actual) return "";
  const { codigo, centro, ...hoja } = actual.hoja || {};
  return JSON.stringify({ hoja, huecos: actual.huecos || [] });
}

export function crearGuardado({ api }) {
  let guardada = null; // { id, codigo, firma }

  return {
    // El código de la hoja en pantalla, si es exactamente la guardada.
    codigoVigente(actual) {
      return guardada && guardada.firma === firmaDe(actual) ? guardada.codigo : "";
    },
    get id() { return guardada?.id || null; },

    // Devuelve el código con el que imprimir, guardándola si hace falta.
    async asegurar(actual, { parametros, centro }) {
      const vigente = this.codigoVigente(actual);
      if (vigente) return { codigo: vigente, nueva: false };
      const firma = firmaDe(actual);
      const r = await api.guardar({ hoja: { ...actual.hoja, centro }, huecos: actual.huecos, parametros });
      guardada = { id: r.id, codigo: r.codigo, firma };
      return { codigo: r.codigo, nueva: true };
    },

    // Una hoja abierta de "Hojas recientes": es la guardada tal cual.
    abierta({ id, codigo }, actual) {
      guardada = { id, codigo, firma: firmaDe(actual) };
    },
  };
}
