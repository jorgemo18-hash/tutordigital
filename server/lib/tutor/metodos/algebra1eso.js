// LOS PASOS DEL TEMA «ÁLGEBRA» DE 1.º ESO, uno por batería (migración 138).
//
// El molde para el resto de temas (2/10/2026). Los errores son los del
// catálogo del tema (trampasAlgebra.js y la migración):
//   1 doble de la suma sin paréntesis · 2 pega el coeficiente y el número ·
//   3 junta términos no semejantes · 4 multiplica solo el primer término del
//   paréntesis · 5 pasa un término sin cambiarle el signo · 6 pasa restando
//   lo que multiplica · 7 divide antes de pasar el término · 8 en la
//   ecuación, el paréntesis solo al primero · 9 x² como el doble de x ·
//   10 método bien, cuenta mal · 11 descuido al copiar.
const H = (id, alumno, termina, errores, pista) => ({ id, alumno, termina, errores, pista });

const DESPEJAR = (errores) => H("despejar", "Deja la x sola", "x_despejada", errores,
  "¿Qué número acompaña todavía a la x y qué operación está haciendo con ella?");

export const METODOS_ALGEBRA_1ESO = {
  tema: "c0000000-0000-4000-8000-000000000005",
  erroresDeCualquierPaso: [10, 11],
  porClave: {
    // ── Lenguaje algebraico y valor numérico ──────────────────────────────
    traduce_enunciado: { hitos: [
      H("traducir", "Escribe la frase con números, letras y operaciones", "expresion_equivalente", [1],
        "Lee la frase por partes: ¿qué es lo primero que se le hace al número?"),
    ] },
    valor_numerico: { hitos: [
      H("sustituir", "Cambia la letra por su valor", "sustitucion", [2, 9],
        "¿Qué operación hay escondida entre el número y la letra cuando van pegados?"),
      H("calcular", "Haz las operaciones", "valor", [],
        "¿Qué operación tienes que hacer primero?"),
    ] },

    // ── Reducir expresiones ──────────────────────────────────────────────
    reduce_semejantes: { hitos: [
      H("reducir", "Junta lo que se pueda juntar", "expresion_reducida", [3],
        "¿Qué términos se pueden sumar entre sí y cuáles no?"),
    ] },
    reduce_con_parentesis: { hitos: [
      H("quitar_parentesis", "Quita el paréntesis", "sin_parentesis", [4],
        "Fíjate en el número de fuera: ¿a qué términos de dentro afecta?"),
      H("reducir", "Junta lo que se pueda juntar", "expresion_reducida", [3],
        "¿Qué términos se pueden sumar entre sí y cuáles no?"),
    ] },

    // ── Secuencias ───────────────────────────────────────────────────────
    siguientes_terminos: { hitos: [
      H("diferencia", "Descubre cuánto cambia de un término al siguiente", "diferencia", [],
        "¿Qué le pasa a cada número para convertirse en el siguiente?"),
      H("siguientes", "Escribe los términos que faltan", "valor", [],
        "Si sigues haciendo lo mismo, ¿qué número viene después del último?"),
    ] },
    termino_lejano: { hitos: [
      H("diferencia", "Descubre cuánto cambia de un término al siguiente", "diferencia", [],
        "¿Qué le pasa a cada número para convertirse en el siguiente?"),
      H("calcular", "Llega al término que te piden sin escribirlos todos", "valor", [],
        "¿Cuántos saltos hay desde el primer término hasta el que te piden?"),
    ] },
    termino_general: { hitos: [
      H("diferencia", "Descubre cuánto cambia de un término al siguiente", "diferencia", [],
        "¿Qué le pasa a cada número para convertirse en el siguiente?"),
      H("regla", "Escribe la regla con la n", "expresion_equivalente", [],
        "Si multiplicas n por ese salto, ¿cuánto te falta o te sobra para llegar al primer término?"),
    ] },

    // ── Ecuaciones de un paso ────────────────────────────────────────────
    comprueba_solucion: { hitos: [
      H("sustituir", "Cambia la x por el número", "sustitucion", [2],
        "¿Qué queda en cada lado del igual si pones el número en lugar de la x?"),
      H("decidir", "Decide si es solución", "decision", [],
        "¿Qué tiene que pasar con los dos lados del igual para que sea solución?"),
    ] },
    ecuacion_suma_resta: { hitos: [DESPEJAR([5])] },
    ecuacion_producto_cociente: { hitos: [DESPEJAR([6])] },

    // ── Ecuaciones de primer grado ───────────────────────────────────────
    ecuacion_dos_pasos: { hitos: [
      H("aislar", "Deja el término con x solo en un lado", "ax_igual_b", [5, 7],
        "De los dos números que acompañan a la x, ¿cuál está más «lejos» de ella?"),
      DESPEJAR([6]),
    ] },
    ecuacion_x_dos_lados: { hitos: [
      H("agrupar", "Las x a un lado y los números al otro", "x_en_un_lado", [5],
        "¿En qué lado quieres tener las x y en cuál los números?"),
      H("reducir", "Junta las x y junta los números", "ax_igual_b", [3],
        "¿Cuántas x tienes ahora en total en ese lado?"),
      DESPEJAR([6]),
    ] },
    ecuacion_con_parentesis: { hitos: [
      H("quitar_parentesis", "Quita el paréntesis", "sin_parentesis", [8],
        "Fíjate en el número de fuera: ¿a qué términos de dentro afecta?"),
      H("agrupar", "Las x a un lado y los números al otro", "x_en_un_lado", [5],
        "¿En qué lado quieres tener las x y en cuál los números?"),
      DESPEJAR([6, 7]),
    ] },

    // ── Problemas con ecuaciones ─────────────────────────────────────────
    problemas_ecuacion_numeros: { hitos: [
      H("plantear", "Escribe la ecuación que dice el problema", "ecuacion_planteada", [1],
        "Si llamas x al número que buscas, ¿cómo escribirías lo que le pasa según el enunciado?"),
      H("resolver", "Resuelve la ecuación", "x_despejada", [5, 6, 7],
        "¿Qué está estorbando a la x en tu ecuación?"),
      H("responder", "Contesta a la pregunta del problema", "lo_juzga_el_tutor", [],
        "Vuelve a leer la pregunta: ¿qué te pedía exactamente?"),
    ] },
    problemas_ecuacion_repartos: { hitos: [
      H("incognita", "Elige qué es la x y escribe lo demás con ella", "lo_juzga_el_tutor", [],
        "Si x es una de las cantidades, ¿cómo escribirías la otra usando la x?"),
      H("plantear", "Escribe la ecuación que dice el problema", "ecuacion_planteada", [1],
        "¿Qué dato del enunciado relaciona las dos cantidades?"),
      H("resolver", "Resuelve la ecuación", "x_despejada", [3, 5, 6, 8],
        "¿Qué está estorbando a la x en tu ecuación?"),
      H("responder", "Contesta a lo que pregunta el problema", "lo_juzga_el_tutor", [],
        "Ya sabes cuánto vale la x: ¿te preguntaban solo eso o algo más?"),
    ] },
  },
};
