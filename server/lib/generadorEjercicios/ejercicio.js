import { render, renderLatex, evaluar } from "./expresion.js";

// LA FORMA DE UN EJERCICIO GENERADO, y cómo se convierte en una actividad de
// la hoja.
//
// Un generador devuelve MÁS de lo que se imprime, a propósito:
//
//   - `latex` es lo que va al folio.
//   - `texto` es lo mismo en texto plano, para leerlo en un log o en un test
//     sin llenarse de barras invertidas.
//   - `arbol` es la expresión, que es lo único con lo que después se puede
//     recalcular o generar una variante.
//   - `solucion` es el número. NO se imprime en la hoja (la hoja no lleva
//     soluciones), pero sin él no hay forma de corregir ni de medir nada.
//
// Guardar solo el texto impreso sería el mismo error que guardar la
// expresión como cadena: se pierde lo que permite trabajar con el ejercicio
// después de imprimirlo.

// Convierte una expresión en un apartado, resolviéndola. Devuelve null si la
// expresión no vale como ejercicio (división no exacta, número demasiado
// grande…): quien llama descarta y prueba otra.
export function apartadoDeExpresion(arbol, { tope, ...estilo } = {}) {
  const { valor, motivo } = evaluar(arbol, tope === undefined ? {} : { tope });
  if (valor === null) return { apartado: null, motivo };
  return {
    apartado: {
      latex: `$${renderLatex(arbol, estilo)}=$ ___`,
      // El mismo apartado con el resultado puesto, para cuando se imprime
      // como ejemplo resuelto. Se renderiza del árbol con el MISMO estilo, no
      // se parchea la cadena de arriba: si se hiciera con una expresión
      // regular, un cambio en el formato del hueco rompería el ejemplo sin
      // que nada avisara.
      latexResuelto: `$${renderLatex(arbol, estilo)}=${valor}$`,
      texto: `${render(arbol, estilo)} = ___`,
      arbol,
      solucion: valor,
    },
    motivo: null,
  };
}

// Intenta `intentos` veces construir un apartado y se queda con los que
// salen limpios y no repetidos.
//
// EL LÍMITE DE INTENTOS NO ES PARANOIA. Hay combinaciones de restricciones
// que casi no tienen soluciones (un tope pequeño con cuatro condiciones a la
// vez), y sin tope el generador se quedaría girando dentro de una petición
// web. Preferimos una batería de 5 apartados en vez de 8 antes que una hoja
// que no llega nunca.
export function reuneApartados(construye, { cuantos, intentos = 200, clave = (a) => a.texto } = {}) {
  const apartados = [];
  const vistos = new Set();
  let descartados = 0;
  for (let i = 0; i < intentos && apartados.length < cuantos; i += 1) {
    const candidato = construye();
    if (!candidato) { descartados += 1; continue; }
    const k = clave(candidato);
    // NO SE REPITE NINGUNO. Una batería de ocho sumas con dos idénticas
    // parece descuidada, y con números de una cifra las repeticiones salen
    // solas más a menudo de lo que uno espera.
    if (vistos.has(k)) { descartados += 1; continue; }
    vistos.add(k);
    apartados.push(candidato);
  }
  return { apartados, descartados };
}

// La actividad tal como la espera la plantilla de la hoja (ver
// assets/shared/hoja/muestras/enteros1eso.js): `apartados` son cadenas ya en
// LaTeX, y las soluciones NO viajan al folio.
export function aActividadDeHoja(ejercicio) {
  const actividad = {
    enunciado: ejercicio.enunciado,
    tipo: ejercicio.tipo || "ejercicio",
    dificultad: ejercicio.dificultad || 2,
  };
  if (ejercicio.columnas) actividad.columnas = ejercicio.columnas;
  if (ejercicio.lineas) actividad.lineas = ejercicio.lineas;
  if (ejercicio.apartados?.length) {
    // UN APARTADO NORMAL BAJA COMO CADENA Y UNO RESUELTO COMO OBJETO.
    //
    // La plantilla acepta las dos formas (ver assets/shared/hoja/js/
    // actividades.js) y eso es deliberado: la hoja de muestra escrita a mano
    // lleva cadenas, y convertirlas todas en objetos solo para que el ejemplo
    // quepa habría obligado a tocar ese archivo y el de la plantilla por una
    // razón que no es suya. Lo que la hoja necesita saber de un apartado es
    // su texto y, si es el ejemplo, que lo es y por qué.
    //
    // UN APARTADO CON FIGURA también baja como objeto: la recta numérica no
    // es texto y no cabe en la cadena (ver assets/shared/hoja/js/
    // rectaNumerica.js). Lo que baja es el DATO de la figura; el dibujo lo
    // hace la plantilla.
    actividad.apartados = ejercicio.apartados.map(aApartadoDeHoja);
  }
  return actividad;
}

function aApartadoDeHoja(a) {
  if (!a.resuelto && !a.figura) return a.latex;
  const apartado = { texto: a.latex };
  if (a.resuelto) Object.assign(apartado, { resuelto: true, explicacion: a.explicacion });
  if (a.figura) apartado.figura = a.figura;
  return apartado;
}

// Las soluciones de un ejercicio, en el orden de sus apartados. Es lo que se
// guardará junto a la hoja para poder corregir después.
export function solucionesDe(ejercicio) {
  return (ejercicio.apartados || []).map((a) => a.solucion);
}
