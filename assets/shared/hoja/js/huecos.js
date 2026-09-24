// LOS HUECOS PARA CONTESTAR EN LÍNEA: "a₁ = ___".
//
// En el contenido de la hoja se escriben como tres o más guiones bajos, igual
// que se escriben a mano. Aquí se convierten en un subrayado de verdad, con
// ancho mínimo, para que no salgan huecos de dos milímetros donde hay que
// escribir un número de tres cifras.
//
// SE CONSTRUYE CON NODOS DE TEXTO, NUNCA CON innerHTML: el enunciado de un
// ejercicio lo va a generar un modelo, así que se trata como dato de entrada
// aunque venga de nuestra propia base de datos.

const MARCA = /_{3,}/g;

// UN HUECO MEDIO: de seis a ocho guiones. Para una respuesta de unos
// cuantos caracteres ("6,4 · 10⁸", "947 000") en una batería a dos
// columnas, donde el largo no cabe y parte la línea.
export const LARGO_DEL_HUECO_MEDIO = 6;

// UN HUECO LARGO: nueve guiones bajos o más. Para las respuestas que son una
// LISTA ("los divisores de 72": doce números) o una descomposición: en un
// hueco de 14 mm no caben, y el alumno acaba escribiendo encima del texto.
// Se decide por el largo de la marca, que es como se haría a mano.
export const LARGO_DEL_HUECO_LARGO = 9;

export function fragmentoConHuecos(texto = "", doc = globalThis.document) {
  const frag = doc.createDocumentFragment();
  const cadena = String(texto);
  let ultimo = 0;

  // exec en bucle en vez de split para no perder la posición de cada marca.
  MARCA.lastIndex = 0;
  let m = MARCA.exec(cadena);
  while (m) {
    if (m.index > ultimo) frag.appendChild(doc.createTextNode(cadena.slice(ultimo, m.index)));
    const hueco = doc.createElement("span");
    hueco.className = m[0].length >= LARGO_DEL_HUECO_LARGO
      ? "hj-hueco hj-hueco--largo"
      : m[0].length >= LARGO_DEL_HUECO_MEDIO ? "hj-hueco hj-hueco--medio" : "hj-hueco";
    frag.appendChild(hueco);
    ultimo = m.index + m[0].length;
    m = MARCA.exec(cadena);
  }

  if (ultimo < cadena.length) frag.appendChild(doc.createTextNode(cadena.slice(ultimo)));
  return frag;
}

export function tieneHuecos(texto = "") {
  MARCA.lastIndex = 0;
  return MARCA.test(String(texto));
}
