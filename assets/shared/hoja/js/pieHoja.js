// EL PIE DE LA HOJA: marca, centro y código.
//
// Lo importante es el código (ver codigoHoja.js). La marca va en el pie y no
// en la cabecera a propósito: la cabecera es del alumno y del objetivo de la
// hoja, y una hoja de clase con un logo grande arriba parece publicidad. En el
// pie identifica el material sin quitarle sitio a lo que hay que estudiar.

export function buildPie({
  marca = "TutorDigital",
  centro = "",
  codigo = "",
  doc = globalThis.document,
} = {}) {
  const pie = doc.createElement("footer");
  pie.className = "hj-foot";

  const izq = doc.createElement("span");
  izq.className = "hj-foot-marca";
  izq.textContent = [marca, centro].filter(Boolean).join(" · ");

  const spacer = doc.createElement("span");
  spacer.className = "hj-foot-spacer";

  const der = doc.createElement("span");
  der.className = "hj-foot-codigo";
  der.textContent = codigo;

  pie.append(izq, spacer, der);
  return pie;
}
