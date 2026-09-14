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
    hueco.className = "hj-hueco";
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
