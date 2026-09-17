// Azar REPRODUCIBLE.
//
// POR QUÉ NO `Math.random()`. Una hoja generada tiene que poder volver a
// salir idéntica: es el mismo folio que repartió el profesor, y si dentro de
// tres meses hay que reimprimirlo o mirar en qué falló un alumno, tiene que
// ser el mismo papel. Con `Math.random()` una hoja solo existe mientras esté
// guardada fila a fila; con una semilla, la hoja ES su semilla.
//
// Y para los tests, que es la otra mitad: un generador que usa el azar del
// sistema no se puede probar. Con semilla fija, el test comprueba que una
// semilla concreta da un ejercicio concreto, y un cambio accidental en el
// generador se ve.
//
// El algoritmo es mulberry32: 32 bits de estado, distribución buena de
// sobra para elegir números de dos cifras, y cuatro líneas que se leen. No
// hace falta nada criptográfico — aquí el azar decide si sale un 7 o un −4.

export function crearAzar(semilla) {
  // La semilla puede llegar como texto (el código de la hoja), así que se
  // convierte a entero de forma estable. Sin esto, dos hojas distintas con
  // códigos parecidos podrían compartir números.
  let estado = typeof semilla === "number" ? semilla >>> 0 : hashTexto(String(semilla ?? ""));
  // Una semilla de 0 deja mulberry32 en un estado degenerado (devuelve
  // siempre lo mismo). Se desplaza a un valor cualquiera distinto de cero.
  if (estado === 0) estado = 0x9e3779b9;

  function siguiente() {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    // Entero en [min, max], los dos incluidos.
    entero(min, max) {
      const a = Math.ceil(Math.min(min, max));
      const b = Math.floor(Math.max(min, max));
      return a + Math.floor(siguiente() * (b - a + 1));
    },

    // Un elemento de la lista. Lista vacía -> undefined (no revienta: quien
    // llama decide, y en un generador eso significa "no hay candidatos").
    elige(lista) {
      if (!Array.isArray(lista) || !lista.length) return undefined;
      return lista[Math.floor(siguiente() * lista.length)];
    },

    // true con la probabilidad dada (0..1).
    suerte(probabilidad = 0.5) {
      return siguiente() < probabilidad;
    },

    // Copia mezclada. NO muta la lista que recibe: los catálogos que vienen
    // de la base de datos se reutilizan entre ejercicios de la misma hoja.
    mezcla(lista) {
      const copia = Array.isArray(lista) ? [...lista] : [];
      for (let i = copia.length - 1; i > 0; i -= 1) {
        const j = Math.floor(siguiente() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
      }
      return copia;
    },

    // Un signo, que es lo que más se sortea en este tema.
    signo() {
      return siguiente() < 0.5 ? -1 : 1;
    },
  };
}

// FNV-1a de 32 bits. Se usa solo para convertir una semilla de texto en un
// número; no es una función de hash con pretensiones.
function hashTexto(texto) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
