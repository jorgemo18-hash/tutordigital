import { LATEX, TEXTO } from "../expresion.js";

// UNA IGUALDAD CON UN HUECO: `-20 +  ___ = -36`, `-36 :  ___ = 9`.
//
// Esto no es una expresión y por eso no vive en `expresion.js`: un hueco no
// tiene valor, así que no hay árbol que lo represente ni evaluador que lo
// resuelva. Es un ENUNCIADO con un espacio en medio, y lo único que se
// comparte con las expresiones es cómo se imprimen los paréntesis.
//
// Vive en su propio archivo porque lo usan al menos dos objetivos distintos
// —el término que falta (suma) y el factor que falta (producto)— y las dos
// reglas delicadas que tiene son exactamente las mismas en los dos casos.

const CLAVE_UNION = { "+": "suma", "-": "menos", "·": "producto", ":": "division" };

// REGLA 1: EL HUECO VA FUERA DEL LaTeX.
//
// La plantilla convierte `___` en un `<span>` subrayado ANTES de que KaTeX
// recorra la hoja (ver hoja/js/huecos.js y formulasDeLaHoja.js), y KaTeX no
// empareja un `$` de apertura con uno de cierre que estén en lados distintos
// de un elemento. Si el hueco quedara DENTRO de la fórmula, el `$` se
// partiría en dos mitades desparejadas y el apartado saldría impreso en
// crudo, con los dólares a la vista.
//
// Así que cada par `$...$` se cierra por su cuenta y el hueco va en medio.
//
// REGLA 2: EL `\;` ES AIRE, y salió de mirar el folio impreso.
//
// Sin él se imprimía `8+______ = 25`, con el signo pegado al subrayado.
//
// Y EL MOTIVO NO ES EL QUE PARECE, que es justo por lo que está escrito aquí.
// La primera explicación que me di fue "en LaTeX el `+` no lleva espacio
// alrededor", y de ahí salió una versión de este archivo que solo ponía el
// `\;` con `+` y `−` porque `\cdot` y `:` ya traen el suyo. Es falso: el
// espacio que se pierde está EN EL BORDE ENTRE ELEMENTOS HTML, no dentro de
// la fórmula. KaTeX cierra su caja pegada al último símbolo y el espacio
// literal que hay en la cadena entre el `$` de cierre y el `___` se colapsa.
// Le pasa igual a los cuatro operadores, así que el aire va siempre.
//
// Y HACEN FALTA DOS, UNO A CADA LADO DEL OPERADOR, en las dos posiciones del
// hueco. El motivo es de TeX: un operador binario que abre o cierra la
// fórmula se queda sin uno de sus operandos, deja de tratarse como binario y
// pierde el espacio de los DOS lados — no solo del que le falta.
//
// Se descubrió en dos pasadas, y la primera se quedó a medias: en el folio
// salió `___ ·4 = -20` (el punto pegado al 4) y se arregló solo la posición
// de delante. La siguiente impresión trajo el simétrico, `4· ___ = -36`, con
// el punto pegado al 4 por el otro lado. Es el mismo fallo visto desde el
// otro extremo, así que el aire va a los dos lados siempre.
const AIRE = "\\;";

// Un negativo a la derecha de un operador se envuelve; un positivo, no. A la
// izquierda va desnudo. Es el mismo criterio que el renderizador de
// expresiones, y dicho aquí otra vez a propósito: si divergieran, un folio se
// imprimiría distinto de lo que dice el texto que los tests leen.
function aLaDerecha(n) {
  return n < 0 ? `(${n})` : String(n);
}

// Devuelve el apartado listo para la hoja. `izq` y `der` son los dos
// operandos de la igualdad completa, `huecoDetras` decide cuál se tapa, y
// `arbol` es la expresión completa —la que ya se ha resuelto— que se guarda
// para poder recalcular después.
//
// La SOLUCIÓN es el operando tapado, no el total: lo que el alumno escribe en
// el hueco.
export function conHueco({ izq, der, operador, total, huecoDetras, arbol }) {
  const union = CLAVE_UNION[operador];
  if (!union) throw new Error(`operador sin unión conocida: ${operador}`);
  const visible = huecoDetras ? izq : der;
  const oculto = huecoDetras ? der : izq;

  const visibleLatex = huecoDetras ? String(visible) : aLaDerecha(visible);
  const latex = huecoDetras
    ? `$${visibleLatex}${AIRE}${LATEX[union]}${AIRE}$ ___ $=${total}$`
    : `___ $${AIRE}${LATEX[union]}${AIRE}${visibleLatex}=${total}$`;

  const enTexto = huecoDetras
    ? `${visible}${TEXTO[union]}___`
    : `___${TEXTO[union]}${aLaDerecha(visible)}`;

  // `latexResuelto` es el MISMO apartado con la respuesta puesta en el hueco,
  // para cuando toca imprimirlo como ejemplo. Se construye aquí y no
  // parcheando la cadena después: aquí están los dos operandos y se sabe en
  // qué lado va el hueco, y una expresión regular sobre `latex` tendría que
  // adivinarlo.
  const resueltoIzq = huecoDetras
    ? `${visibleLatex}${LATEX[union]}${aLaDerecha(oculto)}`
    : `${oculto}${LATEX[union]}${visibleLatex}`;
  const latexResuelto = `$${resueltoIzq}=${total}$`;

  // `visible` y `total` viajan junto al apartado porque hay condiciones que
  // solo se pueden juzgar con ellos: ver `hayAlgunNegativo` y la explicación
  // del hueco. Deducirlos del texto con una expresión regular sería frágil
  // —el guion del operador y el signo del número son el mismo carácter— y es
  // justamente la confusión que este tema intenta deshacer.
  return {
    latex,
    latexResuelto,
    texto: `${enTexto} = ${total}`,
    arbol,
    solucion: oculto,
    visible,
    total,
    operador,
    huecoDetras,
  };
}

// ¿ESTE APARTADO EJERCITA ALGO DE ENTEROS?
//
// `8 + ___ = 25` no. Los tres números que intervienen son positivos: es una
// resta de primaria escrita del revés, y en una hoja de enteros solo ocupa
// sitio. `2 - ___ = 25`, en cambio, sí, aunque a la vista tampoco haya un
// negativo: la respuesta es -23, y llegar a ella ES el contenido.
//
// De ahí que la condición no sea "que se vea un menos" sino que ALGUNO de los
// tres números —el visible, el total y la propia solución— sea negativo. El
// signo que importa puede estar en la respuesta, que es donde no se ve.
export function hayAlgunNegativo(apartado) {
  return apartado.visible < 0 || apartado.total < 0 || apartado.solucion < 0;
}
