// LO QUE ESCRIBE UN ALUMNO, PASADO A LA NOTACIÓN DEL VERIFICADOR.
//
// El verificador (verificador/expresionDeTexto.js) exige `*` para
// multiplicar y no conoce el menos tipográfico, el punto de multiplicar ni
// los dos puntos de dividir. Un alumno de 1.º ESO escribe «2x − 3 = 7»,
// «3(x + 2)», «x : 4 = 5», «2,5x» o «x²». Aquí se traduce una cosa a la
// otra, sin adivinar: si algo no se entiende, se lanza un error y la línea
// queda como «no leída» (el tutor la pregunta; nunca se da por buena ni por
// mala una línea que no se ha entendido).
const SUPERINDICES = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };

export function normaliza(texto) {
  let t = String(texto ?? "").trim();
  if (!t) throw new Error("línea vacía");
  t = t
    .replace(/[−–—]/g, "-")
    .replace(/[·×∙]/g, "*")
    .replace(/÷/g, "/")
    .replace(/:/g, "/")
    .replace(/X/g, "x")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => `^${[...m].map((c) => SUPERINDICES[c]).join("")}`)
    .replace(/\s+/g, " ");
  if (/[^0-9x+\-*/^().= ]/.test(t)) throw new Error(`hay algo que no se entiende: «${t.match(/[^0-9x+\-*/^().= ]/)[0]}»`);

  // Multiplicación escondida: 2x, 3(…), x(…), )(…), )x, )2.
  t = t.replace(/\s+/g, "");
  t = t
    .replace(/(\d)(x|\()/g, "$1*$2")
    .replace(/x(\d|x|\()/g, "x*$1")
    .replace(/\)(\d|x|\()/g, ")*$1");
  return t;
}
