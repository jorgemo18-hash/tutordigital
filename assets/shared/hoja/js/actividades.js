// LAS ACTIVIDADES: el cuerpo de la hoja.
//
// Jorge, el 14/09/2026: *"más variedad que repetición pero sin sacar 100
// ejercicios, más vale calidad y originalidad que cantidad. También cuando sea
// me gustaría que hubiera mezcla de ejercicios y problemas"*.
//
// Eso se traduce en tres cosas que están aquí y no en el contenido:
//
// - TOPE DE ACTIVIDADES. La hoja es un folio y no tiene segunda página. Si
//   entran más de las que caben, sobran ejercicios (no falta papel).
// - "problema" SE ETIQUETA, "ejercicio" NO. Lo normal no necesita etiqueta y
//   así la mezcla se ve de un golpe: si no hay ninguna etiqueta en la hoja,
//   son todos de técnica y está mal montada.
// - CADA ACTIVIDAD ES UN HUECO IDENTIFICADO (`orden`). Cuando el profesor
//   pulse "cambiar este ejercicio", se cambia el contenido del hueco, no se
//   regenera la hoja; y cuando se corrija en papel, lo que se registra es
//   "hoja X, hueco 4, mal".

import { buildDificultad } from "./dificultad.js";
import { fragmentoConHuecos } from "./huecos.js";

export const MAX_ACTIVIDADES = 10;
const LETRAS = "abcdefghij";

function buildApartados(apartados, columnas, doc) {
  const lista = doc.createElement("ol");
  // Las columnas se piden desde el contenido porque dependen de lo corto que
  // sea cada apartado: cuatro "a) 3 + (−5)" caben en dos columnas, un apartado
  // con frase no cabe ni en una.
  const cols = columnas === 3 ? 3 : columnas === 2 ? 2 : 1;
  lista.className = cols > 1 ? `hj-apartados hj-apartados--${cols}` : "hj-apartados";

  apartados.forEach((apartado, i) => {
    // UN APARTADO ES UNA CADENA O UN OBJETO. La cadena es el caso normal; el
    // objeto `{ texto, resuelto, explicacion }` es el apartado ya resuelto que
    // sirve de ejemplo. Se admiten las dos formas porque la hoja escrita a
    // mano usa cadenas y no tiene por qué cambiar.
    const esObjeto = apartado && typeof apartado === "object";
    const texto = esObjeto ? apartado.texto : apartado;
    const resuelto = Boolean(esObjeto && apartado.resuelto);

    const li = doc.createElement("li");
    li.className = resuelto ? "hj-apartado hj-apartado--resuelto" : "hj-apartado";

    const letra = doc.createElement("span");
    letra.className = "hj-apartado-letra";
    letra.textContent = `${LETRAS[i] || "·"})`;

    const cuerpo = doc.createElement("span");
    cuerpo.className = "hj-apartado-cuerpo";
    cuerpo.appendChild(fragmentoConHuecos(texto, doc));

    if (resuelto) {
      // LA PALABRA "EJEMPLO" TIENE QUE ESTAR. Un apartado con la respuesta
      // puesta y sin etiqueta se lee como una errata —o como un ejercicio que
      // alguien ya hizo— y el alumno se lo salta sin entender que es el
      // modelo de los demás. En fotocopia en blanco y negro el fondo gris casi
      // no se ve, así que la etiqueta es lo único que aguanta.
      const marca = doc.createElement("span");
      marca.className = "hj-apartado-marca";
      marca.textContent = "Ejemplo";
      cuerpo.appendChild(marca);

      if (apartado.explicacion) {
        const razon = doc.createElement("span");
        razon.className = "hj-apartado-razon";
        razon.appendChild(fragmentoConHuecos(apartado.explicacion, doc));
        cuerpo.appendChild(razon);
      }
    }

    li.append(letra, cuerpo);
    lista.appendChild(li);
  });

  return lista;
}

function buildEspacio(lineas, doc) {
  const wrap = doc.createElement("div");
  wrap.className = "hj-espacio";
  for (let i = 0; i < lineas; i += 1) {
    const l = doc.createElement("div");
    l.className = "hj-espacio-linea";
    wrap.appendChild(l);
  }
  return wrap;
}

export function buildActividad(act = {}, numero = 1, doc = globalThis.document) {
  const {
    enunciado = "",
    tipo = "ejercicio",
    dificultad = 1,
    apartados = [],
    columnas = 1,
    lineas = 0,
  } = act;

  const wrap = doc.createElement("li");
  wrap.className = "hj-act";
  // El número del hueco viaja en el DOM: es lo que luego une el papel con el
  // registro de intentos.
  wrap.dataset.orden = String(numero);

  const num = doc.createElement("span");
  num.className = "hj-act-num";
  num.textContent = String(numero);

  const cuerpo = doc.createElement("div");
  cuerpo.className = "hj-act-cuerpo";

  const cab = doc.createElement("div");
  cab.className = "hj-act-cab";

  const enun = doc.createElement("p");
  enun.className = "hj-act-enunciado";
  enun.appendChild(fragmentoConHuecos(enunciado, doc));
  cab.appendChild(enun);

  if (tipo === "problema") {
    const chip = doc.createElement("span");
    chip.className = "hj-act-tipo";
    chip.textContent = "Problema";
    cab.appendChild(chip);
  }

  cab.appendChild(buildDificultad(dificultad, doc));
  cuerpo.appendChild(cab);

  if (apartados.length) cuerpo.appendChild(buildApartados(apartados, columnas, doc));
  if (lineas > 0) cuerpo.appendChild(buildEspacio(lineas, doc));

  wrap.append(num, cuerpo);
  return wrap;
}

export function buildActividades(actividades = [], doc = globalThis.document) {
  const seccion = doc.createElement("section");
  seccion.className = "hj-actividades";

  const tit = doc.createElement("div");
  tit.className = "hj-actividades-tit";
  tit.textContent = "Actividades";

  const lista = doc.createElement("ol");
  lista.className = "hj-act-lista";

  actividades.slice(0, MAX_ACTIVIDADES).forEach((act, i) => {
    lista.appendChild(buildActividad(act, i + 1, doc));
  });

  seccion.append(tit, lista);
  return seccion;
}
