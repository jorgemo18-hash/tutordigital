import { por, resta, suma, evaluar } from "../expresion.js";
import { arbolDeSecuencia, elOrdenImporta } from "../secuencia.js";
import { apartadoDeExpresion, reuneApartados } from "../ejercicio.js";

// GENERADORES DE OPERACIONES COMBINADAS (objetivo 6 de Números enteros,
// concepto 12 del catálogo: la jerarquía de operaciones).
//
// ES EL OBJETIVO CON LA INSTRUCCIÓN MÁS EXIGENTE de todo el tema, y no por su
// dificultad sino por una condición que se puede comprobar y casi nunca se
// comprueba:
//
//   *"El objetivo es que el orden importe: SI DA LO MISMO OPERAR DE IZQUIERDA
//   A DERECHA, EL EJERCICIO NO SIRVE."*
//
// Un ejercicio como `2 + 3 + 4 · 1` parece una combinada y no lo es: da 9 por
// los dos caminos, así que el alumno que no sabe la jerarquía lo acierta
// igual y la hoja no se entera. Comprobarlo exige calcular el resultado
// EQUIVOCADO además del correcto, y para eso está `secuencia.js`.
//
// Con un modelo esta condición se cumpliría "casi siempre", que en una hoja
// de cuatro apartados quiere decir que uno de cada cuatro no mide nada.

// Los números de una combinada son pequeños a propósito: lo que se practica
// es el orden, no la aritmética. Si el alumno falla en `47 · 23` falla por
// otra cosa.
const TOPE_TERMINO = 12;
const TOPE_FACTOR = 9;

// ── Arquetipo 24: combinada de un nivel, sin paréntesis ───────────────────

// "Operación combinada de un nivel" (dificultad 2).
// Instrucción: de 3 a 4 apartados que mezclen sumas o restas con un producto
// o un cociente, SIN paréntesis.
export function combinadaDeUnNivel(azar, { cuantos = 4, tope = 200 } = {}) {
  const { apartados } = reuneApartados(
    () => unaSecuencia(azar, { terminos: azar.entero(3, 5), tope }),
    { cuantos },
  );

  return {
    clave: "combinada_un_nivel",
    arquetipo: "Operación combinada de un nivel",
    enunciado: "Calcula respetando la jerarquía de las operaciones:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    lineas: 1,
    apartados,
  };
}

// ── Arquetipo 25: señalar la operación preferente ─────────────────────────

// "Subraya la operación que tiene preferencia y calcula" (dificultad 2).
// Instrucción: de 4 a 6 expresiones en las que primero hay que señalar qué se
// opera antes y luego resolver. "Hace explícito el proceso en vez de solo el
// resultado, y por eso distingue al que sabe la regla del que acierta por
// suerte."
//
// MISMAS EXPRESIONES, OTRA TAREA. No hace falta otro generador de
// expresiones: lo que cambia es el enunciado y lo que se le pide al alumno.
// Y la mitad llevan un paréntesis, porque la gracia del ejercicio está en que
// la respuesta a "¿qué va primero?" no sea siempre "el producto".
export function subrayaLaPreferente(azar, { cuantos = 5, tope = 200 } = {}) {
  // SE CUENTAN LOS APARTADOS ACEPTADOS, NO LOS INTENTOS.
  //
  // La primera versión alternaba en cada intento (`conParentesis =
  // !conParentesis`) y salían baterías con los cinco apartados con
  // paréntesis, 14 de cada 300. El motivo: cuando un candidato plano se
  // descarta —porque el orden no importaba, o porque no salía ningún
  // negativo— el turno siguiente le tocaba al de paréntesis, que se descarta
  // menos. Los descartes desequilibraban la alternancia.
  //
  // Contando los que de verdad entran, el reparto se mantiene aunque un tipo
  // falle más que el otro.
  let conGrupo = 0;
  let planos = 0;
  const { apartados } = reuneApartados(() => {
    const toca = conGrupo <= planos ? "grupo" : "plano";
    const candidato = toca === "grupo"
      ? unaConGrupo(azar, { tope })
      : unaSecuencia(azar, { terminos: azar.entero(3, 4), tope });
    if (!candidato) return null;
    if (toca === "grupo") conGrupo += 1;
    else planos += 1;
    return candidato;
  }, { cuantos });

  return {
    clave: "subraya_la_preferente",
    arquetipo: "Subraya la operación que tiene preferencia y calcula",
    enunciado: "Subraya la operación que hay que hacer primero y después calcula:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    lineas: 1,
    apartados,
  };
}

// ── Arquetipo 26: dos niveles, paréntesis y corchetes ─────────────────────

// "Operación combinada con paréntesis y corchetes" (dificultad 3).
// Instrucción: de 2 a 4 apartados con DOS niveles y las cuatro operaciones,
// todas las divisiones exactas y el resultado entero. Ejemplo del catálogo:
// `2 · [8 - 4 · (10 - 6) - (-3 - 2)]`.
//
// El corchete del nivel de fuera no lo pone este archivo: lo decide el
// renderizador al ver que dentro ya hay un paréntesis (ver expresion.js).
// Aquí solo se construye el árbol con dos niveles de anidamiento.
export function combinadaConCorchetes(azar, { cuantos = 3, tope = 400 } = {}) {
  const { apartados } = reuneApartados(() => {
    // Nivel interior: el paréntesis de dentro.
    const dentro = azar.suerte(0.5)
      ? resta(azar.entero(2, TOPE_TERMINO), azar.entero(2, TOPE_TERMINO))
      : suma(azar.signo() * azar.entero(2, TOPE_TERMINO), azar.entero(2, TOPE_TERMINO));

    // Nivel intermedio: una cadena que CONTIENE el paréntesis, con un
    // producto dentro para que las cuatro operaciones aparezcan.
    const conProducto = por(azar.entero(2, 5), dentro);
    const otroGrupo = resta(azar.signo() * azar.entero(2, 9), azar.entero(2, 9));

    // NINGÚN PARÉNTESIS PUEDE VALER 0 NI ±1, y este guardián faltaba aquí
    // aunque la batería del paréntesis suelto ya lo tenía. En el folio salió
    // `-3 · [5 - 4 · (7 - 6) - (4 - 4)]`: el primer paréntesis vale 1, así
    // que el producto que lo envuelve no hace nada, y el segundo vale 0, así
    // que el término entero desaparece. Dos de los tres niveles del apartado
    // más difícil de la hoja, anulados.
    if (!sirveDeGrupo(dentro, tope) || !sirveDeGrupo(otroGrupo, tope)) return null;
    const intermedio = azar.suerte(0.5)
      ? resta(resta(azar.entero(2, TOPE_TERMINO), conProducto), otroGrupo)
      : suma(resta(azar.entero(2, TOPE_TERMINO), conProducto), otroGrupo);

    // Nivel exterior: el corchete multiplicado o dividido por un número.
    const fuera = azar.signo() * azar.entero(2, 5);
    const arbol = azar.suerte(0.7) ? por(fuera, intermedio) : por(intermedio, fuera);

    const { apartado } = apartadoDeExpresion(arbol, { tope });
    // SIN NEGATIVO NO ES UNA COMBINADA DE ENTEROS, es una de naturales con
    // corchetes. Mismo criterio que en las demás baterías del tema.
    if (!apartado || !/-\d/.test(apartado.texto)) return null;
    return apartado;
  }, { cuantos });

  return {
    clave: "combinada_con_corchetes",
    arquetipo: "Operación combinada con paréntesis y corchetes",
    enunciado: "Calcula, empezando por el paréntesis de dentro:",
    tipo: "ejercicio",
    dificultad: 3,
    columnas: 1,
    lineas: 2,
    apartados,
  };
}

// ── Construcción de las expresiones ───────────────────────────────────────

// ¿Sirve este paréntesis como paréntesis? Valiendo 0 o ±1 deja de importar:
// multiplicar por 1 no hace nada, por 0 se lleva el término entero, y sumar 0
// tampoco cambia nada. El apartado sigue siendo correcto y deja de medir si
// el alumno entiende la jerarquía, que es lo único que mide.
function sirveDeGrupo(grupo, tope) {
  const { valor } = evaluar(grupo, { tope });
  return valor !== null && Math.abs(valor) > 1;
}

// Una secuencia plana donde EL ORDEN IMPORTA. Se sortea, se evalúa por los
// dos caminos y se descarta si coinciden — que con números pequeños pasa más
// a menudo de lo que uno esperaría.
function unaSecuencia(azar, { terminos, tope }) {
  const piezas = [azar.signo() * azar.entero(2, TOPE_TERMINO)];
  let hayNegativo = piezas[0] < 0;
  // AL MENOS UN PRODUCTO O COCIENTE, porque sin él no hay jerarquía que
  // aplicar: se garantiza uno y los demás se sortean.
  const puestoPrioritario = azar.entero(1, terminos - 1);
  for (let i = 1; i < terminos; i += 1) {
    const prioritario = i === puestoPrioritario || azar.suerte(0.3);
    if (prioritario) {
      // Solo productos: un cociente en medio de una cadena plana casi nunca
      // sale exacto por los dos caminos y se descartaría casi siempre.
      piezas.push("·", azar.entero(2, TOPE_FACTOR));
    } else {
      // ALGÚN TÉRMINO NEGATIVO, y esto no lo pide el arquetipo: su ejemplo
      // (`4 + 5 - 6 · 2 + 7 - 10`) es de naturales. Lo pide el TEMA. Una
      // combinada de naturales practica la jerarquía, que el alumno dio en
      // 6.º de primaria; lo que hace de esto un ejercicio de 1.º ESO es tener
      // que aplicar la jerarquía Y los signos a la vez. Sin un solo negativo
      // el apartado es correcto y está en la hoja equivocada.
      //
      // Un negativo aquí se imprime con sus paréntesis de signo —`4 + (-5)`—
      // que NO son paréntesis de agrupación: la jerarquía sigue sin estar
      // escrita, que es lo que el arquetipo exige.
      const magnitud = azar.entero(2, TOPE_TERMINO);
      const negativo = azar.suerte(0.3);
      if (negativo) hayNegativo = true;
      piezas.push(azar.suerte(0.5) ? "+" : "-", negativo ? -magnitud : magnitud);
    }
  }

  // EL NEGATIVO SE GARANTIZA, NO SE ESPERA. Descartar los candidatos sin
  // negativo funcionaba, pero tira una parte grande de los intentos y la
  // batería se quedaba corta. Si no ha salido ninguno, se le da la vuelta al
  // primer término, que es el único que se puede cambiar sin tocar la
  // estructura de la secuencia.
  if (!hayNegativo) piezas[0] = -Math.abs(piezas[0]);

  const arbol = arbolDeSecuencia(piezas);
  const { apartado } = apartadoDeExpresion(arbol, { tope });
  if (!apartado) return null;
  if (!elOrdenImporta(piezas, apartado.solucion)) return null;
  // AQUÍ NO HACE FALTA COMPROBAR QUE HAYA UN NEGATIVO, y lo escribo porque
  // había un `if` que lo comprobaba y lo he quitado. Con la garantía de
  // arriba —si no ha salido ninguno, se le da la vuelta al primer término— el
  // caso no puede ocurrir, así que el `if` era código muerto: ningún test
  // podía distinguir si estaba o no. Una protección que no se puede probar
  // aparenta cubrir algo y no cubre nada, y el siguiente que lea esto no
  // sabría cuál de las dos capas es la que manda.
  return apartado;
}

// Una expresión con UN paréntesis y un producto fuera: `2 - (7 - 5) · 4`, el
// ejemplo del catálogo. Aquí la operación preferente NO es el producto, es el
// paréntesis, que es lo que hace falta para que la batería no se conteste con
// un patrón.
function unaConGrupo(azar, { tope }) {
  // DÓNDE VA EL NEGATIVO SE DECIDE ANTES, por el mismo motivo que en la
  // secuencia plana: dejarlo al azar y descartar lo que saliera sin negativo
  // tiraba tantos intentos que la batería salía con un solo apartado con
  // paréntesis de cinco.
  const negativoEnElGrupo = azar.suerte(0.5);
  const grupo = negativoEnElGrupo
    ? suma(-azar.entero(2, TOPE_TERMINO), azar.entero(2, TOPE_TERMINO))
    : resta(azar.entero(2, TOPE_TERMINO), azar.entero(2, TOPE_TERMINO));
  const factor = azar.entero(2, TOPE_FACTOR);
  const suelto = negativoEnElGrupo
    ? azar.entero(2, TOPE_TERMINO)
    : -azar.entero(2, TOPE_TERMINO);

  // `suelto - (grupo) · factor` y `(grupo) · factor + suelto`: se alterna
  // para que el paréntesis no esté siempre en el mismo sitio.
  const producto = azar.suerte(0.5) ? por(grupo, factor) : por(factor, grupo);
  const arbol = azar.suerte(0.5) ? resta(suelto, producto) : suma(producto, suelto);

  // El grupo tiene que servir de grupo: ver `sirveDeGrupo`.
  if (!sirveDeGrupo(grupo, tope)) return null;

  // El negativo lo garantiza `negativoEnElGrupo` de arriba, así que aquí
  // tampoco se comprueba: misma razón que en la secuencia plana.
  const { apartado } = apartadoDeExpresion(arbol, { tope });
  return apartado;
}
