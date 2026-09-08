// La casilla del cuadrante en modo "enseñar a una familia": cuántas plazas
// quedan, sin un solo nombre.
//
// PARA QUÉ. Cuando una madre pregunta qué días puede traer a su hijo, lo
// que resuelve la conversación es girar la pantalla. Hoy no se puede: el
// cuadrante lleva los nombres y los cursos de los demás alumnos, y eso no
// se le enseña a nadie de fuera. Jorge acababa contándolo de memoria.
//
// POR QUÉ NO VA EN EL PAPEL. Ya se decidió (03/09) que la hoja impresa NO
// lleva plazas libres: se queda dos semanas en la nevera y miente esa misma
// tarde. En pantalla el dato es de hace un segundo, así que aquí sí.
//
// DICE LO QUE QUEDA, NO LO QUE HAY. El "4/6" del cuadrante está pensado
// para quien gestiona: cuántos tengo. A quien pregunta le importa lo otro,
// y obligarle a restar delante de ti es justo la fricción que se quiere
// quitar.
//
// EL NÚMERO ES CONSERVADOR A PROPÓSITO. `ocupacion` es el momento de más
// gente de la hora (ver horarioCelda.js), así que "quedan 2" significa
// quedan 2 en el peor momento. Prometer una plaza que existe solo media
// hora sería peor que quedarse corto.

const CLASE = "ac-plazas";

function buildTexto(libres) {
  const box = document.createElement("div");
  box.className = "ac-plazas-txt";
  if (libres <= 0) {
    const completo = document.createElement("span");
    completo.className = "ac-plazas-completo";
    completo.textContent = "Completo";
    box.appendChild(completo);
    return box;
  }
  const n = document.createElement("span");
  n.className = "ac-plazas-num";
  n.textContent = String(libres);
  const etiqueta = document.createElement("span");
  etiqueta.className = "ac-plazas-label";
  etiqueta.textContent = libres === 1 ? "plaza libre" : "plazas libres";
  box.append(n, etiqueta);
  return box;
}

// `maxPorFranja` es obligatorio y mayor que cero: sin tope no existe la idea
// de "plaza libre" y esta vista no se ofrece siquiera (ver horario.js, que
// solo pinta el botón si el centro tiene máximo configurado). Se comprueba
// igual porque una celda que restara contra 0 diría "Completo" en un centro
// sin tope, que es exactamente lo contrario de la verdad.
export function buildCeldaPlazas({ ocupacion = 0 } = {}, maxPorFranja = 0) {
  const cell = document.createElement("div");
  const max = Number(maxPorFranja) || 0;
  if (max <= 0) {
    cell.className = "ac-cell empty";
    return cell;
  }

  const libres = Math.max(0, max - Number(ocupacion || 0));
  const completa = libres <= 0;
  // `filled` siempre, incluso con la hora entera libre: en esta vista todas
  // las casillas son una respuesta ("caben 6"), no un hueco vacío. Con la
  // caja punteada de `empty`, una hora libre parecería una hora en la que
  // el centro no abre — que es justo el malentendido que ya se corrigió en
  // la hoja impresa imprimiendo "Todos" en vez de un blanco.
  cell.className = `ac-cell filled ${CLASE}${completa ? " ac-cell--completa" : ""}`;
  cell.appendChild(buildTexto(libres));
  return cell;
}

const TEXTO_ENTRAR = "Ocultar nombres";
const TEXTO_SALIR = "Ver nombres";

// El interruptor. Dice lo que HACE, no para qué sirve: "Enseñar a una
// familia" obligaría a adivinar qué le pasa a la pantalla al pulsarlo, y
// además esta vista vale para cualquier momento en que haya alguien
// mirando por encima del hombro.
export function buildBotonSinNombres(onToggle) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-btn ac-btn-sinnombres";
  actualizarBotonSinNombres(btn, false);
  btn.addEventListener("click", () => onToggle());
  return btn;
}

// El estado vive en quien pinta, no en el botón: el botón solo se re-rotula.
// `aria-pressed` porque es un interruptor que se queda encendido, no una
// acción que se dispara y se acaba.
export function actualizarBotonSinNombres(btn, sinNombres) {
  btn.textContent = sinNombres ? TEXTO_SALIR : TEXTO_ENTRAR;
  btn.setAttribute("aria-pressed", sinNombres ? "true" : "false");
  btn.title = sinNombres
    ? "Volver al cuadrante con los alumnos"
    : "Deja solo las plazas libres, para poder enseñar la pantalla";
  btn.classList.toggle("ac-btn-sinnombres--activo", Boolean(sinNombres));
}

// La nota de debajo del cuadrante. Las dos versiones existen por lo mismo
// —que una hora no tiene la misma gente de principio a fin— pero le importa
// a cada lector una cosa distinta: al que gestiona, por qué el número no
// cuadra con los nombres que ve; al que pregunta por un hueco, que la plaza
// que se le ofrece la tiene la hora entera.
export function notaDelCuadrante({ sinNombres = false, conMediaHora = false } = {}) {
  if (!conMediaHora) return null;
  const nota = document.createElement("p");
  nota.className = "ac-grid-nota";
  nota.textContent = sinNombres
    ? "Las plazas libres están contadas en el momento de más gente: si pone una, esa hora tiene una libre entera."
    : "* En estos huecos no están todos a la vez: el número es el momento de más gente.";
  return nota;
}
