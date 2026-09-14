// CONTENIDO DE MUESTRA: Matemáticas, 1.º ESO, números enteros.
//
// TEMPORAL Y A MANO. Existe para poder mirar la plantilla en papel y decidir si
// la identidad visual es la que queremos. Cuando el contenido venga de la base
// de datos, este archivo se borra. No se le añaden más temas: si hacen falta
// dos muestras, es que estamos usando esto como banco y no lo es.
//
// POR QUÉ ESTE TEMA Y ESTE OBJETIVO
//
// Jorge, el 14/09/2026: *"empezamos por matemáticas primero de la ESO, busca el
// currículo de la ESO de Aragón y mira qué ven en el primer tema, creo que son
// los números enteros y potencias"*.
//
// El currículo de Aragón (ORDEN ECD/1172/2022) organiza los saberes básicos por
// curso, pero NO fija un orden de temas: el "tema 1" es de la editorial, no del
// currículo. De los saberes de 1.º ESO que toca esta hoja:
//
//   MAT.1.A.2.3  números enteros en la expresión de cantidades en contextos de
//                la vida cotidiana
//   MAT.1.A.2.4  formas de representación de números enteros, incluida la recta
//   MAT.1.A.3.2  operaciones con números enteros en situaciones contextualizadas
//   MAT.1.A.3.3  relaciones inversas entre las operaciones
//
// UN OBJETIVO POR HOJA: "números enteros" da para cuatro o cinco hojas. Esta es
// solo sumar y restar. Las potencias son otra hoja y otro objetivo.
//
// CINCO ACTIVIDADES, NO VEINTE, y con mezcla: tres de técnica y razonamiento
// —una de verdadero/falso, que no es repetición— y dos problemas. Cinco no es
// un número bonito elegido a dedo: es lo que cabe en un folio junto al bloque
// de lo esencial y al ejemplo resuelto (medido, no estimado). Si se quieren
// diez actividades, hay que renunciar a la teoría o a la segunda cara, y
// entonces ya no es esta plantilla.
//
// El último problema es el de las fechas antes de Cristo a propósito: es donde
// se ve si el alumno ha entendido la resta de enteros o solo la ha copiado.

export const HOJA_ENTEROS_1ESO = {
  materia: "Matemáticas",
  curso: "1.º ESO",
  tema: "Números enteros",
  objetivo: "Sumar y restar números enteros",
  centro: "IES Pirámide",

  esencial: {
    titulo: "Lo esencial",
    parrafos: [
      "Los números enteros son los naturales, sus opuestos y el cero: $\\mathbb{Z}=\\{\\ldots,-3,-2,-1,0,1,2,3,\\ldots\\}$. El valor absoluto de un número es su distancia al cero.",
      "Para sumar dos enteros del mismo signo, se suman y se mantiene el signo. Si tienen signos distintos, se resta el pequeño del grande y se pone el signo del que tenga mayor valor absoluto.",
    ],
    formulas: [
      { tex: "a-b=a+(-b)", pie: "restar es sumar el opuesto" },
      { tex: "-(-a)=a", pie: "el opuesto del opuesto" },
      { tex: "|a|\\geq 0", pie: "el valor absoluto nunca es negativo" },
    ],
  },

  ejemplos: [
    {
      enunciado: "Calcula $-7-(-4)+(-6)$",
      pasos: [
        "Quito los paréntesis: restar $-4$ es sumar $+4$, y sumar $-6$ es restar $6$. Queda $-7+4-6$.",
        "Junto los negativos, $-7-6=-13$, y me queda $-13+4$. Signos distintos: $13-4=9$ con el signo del mayor. Resultado: $-9$.",
      ],
    },
  ],

  actividades: [
    {
      enunciado: "Completa:",
      tipo: "ejercicio",
      dificultad: 1,
      columnas: 2,
      apartados: [
        "El opuesto de $-8$ es ___",
        "$|{-15}| =$ ___",
        "$-(-3) =$ ___",
        "El opuesto de $|{-6}|$ es ___",
      ],
    },
    {
      enunciado: "Calcula:",
      tipo: "ejercicio",
      dificultad: 2,
      columnas: 2,
      apartados: [
        "$7-(-4)+(-9)$",
        "$-5-(3-8)$",
        "$-12+(-7)-(-20)$",
        "$(-4+9)-(6-11)$",
      ],
      lineas: 2,
    },
    {
      enunciado: "Verdadero o falso. Justifica cada respuesta con un ejemplo.",
      tipo: "ejercicio",
      dificultad: 2,
      apartados: [
        "Si a un número le restas otro, el resultado siempre es más pequeño.",
        "$-(-a)$ es siempre positivo.",
      ],
      lineas: 2,
    },
    {
      enunciado:
        "Marta tiene 45 € en la cuenta. Le cobran 60 € del gimnasio, luego le ingresan 30 € y paga una compra de 12 €. ¿Con cuánto se queda? ¿Ha estado en negativo en algún momento?",
      tipo: "problema",
      dificultad: 2,
      lineas: 2,
    },
    {
      enunciado:
        "Arquímedes nació el año $-287$ y murió el año $-212$. Ana dice que para saber cuántos años vivió hay que hacer $287-212$. Bruno dice que hay que hacer $-212-(-287)$. ¿Quién lo ha planteado bien? ¿Por qué las dos cuentas dan lo mismo?",
      tipo: "problema",
      dificultad: 3,
      lineas: 2,
    },
  ],
};
