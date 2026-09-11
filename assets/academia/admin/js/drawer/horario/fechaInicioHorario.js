import { formatFechaEs } from "../../utils/formatFecha.js";
import {
  fechaRazonable,
  motivoFechaIrrazonable,
  rangoFechaRazonable,
} from "../../../../../shared/js/fechaRazonable.js";

// "Empieza el ___" del horario: el día a partir del cual el alumno aparece
// en el Diario.
//
// POR QUÉ EXISTE (Jorge, 11/09/2026): *"tengo alumnos activos pero que no
// vienen hasta la semana que viene o hasta octubre, pero los tengo activos
// para que salgan en el horario... tengo que estar todos los días marcando
// ausencia y es un poco rollo"*.
//
// El motor ya estaba: `academia_horario.fecha_inicio` existe, el Diario
// filtra por ella (`fecha_inicio <= fecha`) y el cuadrante NO, así que una
// franja con fecha futura sale en el cuadrante y no en el diario — que es
// exactamente lo que hacía falta. Lo único que faltaba era poder ponerla, y
// que el guardado no la machacara con "hoy".
//
// NO ES LA FECHA DE ALTA, y ese fue el argumento que lo decidió: un alumno
// que se dio de alta el curso pasado y vuelve en octubre conserva su
// fecha_alta de entonces —es un dato histórico y de él dependen sus
// descuentos por intervalo— y lo que cambia es cuándo vuelve al aula. Las
// dos cosas en la misma columna obligan a mentir en una para arreglar la
// otra.
//
// UNA fecha para todo el horario que se guarda, no una por franja (decisión
// de Jorge). La columna de la base de datos ES por franja, así que el día
// que haga falta "martes desde octubre, jueves desde noviembre" se puede
// afinar sin migración.
export function buildFechaInicioHorario({ hoyISO, fechaInicioActual = "" } = {}) {
  const hoy = hoyISO || new Date().toISOString().slice(0, 10);

  const wrap = document.createElement("div");
  wrap.className = "ac-field";

  const label = document.createElement("label");
  label.className = "ac-field-label";
  label.textContent = "Empieza el";
  wrap.appendChild(label);

  const input = document.createElement("input");
  input.type = "date";
  input.className = "ac-input";
  // Por defecto la fecha que ya tenía el horario, o hoy en un alumno nuevo.
  // Nunca vacío: un campo de fecha en blanco invita a dejarlo así, y
  // entonces nadie sabe desde cuándo cuenta ese horario.
  input.value = fechaInicioActual || hoy;
  // Un año disparatado aquí es lo que esconde a un alumno del Diario para
  // siempre (ver fechaRazonable.js: un alumno de Lyceo tenía 1013-11-05).
  // `min`/`max` para que el navegador lo marque al teclearlo; el bloqueo de
  // verdad está en `esValida`, que el drawer consulta antes de guardar.
  const rango = rangoFechaRazonable(hoy);
  input.min = rango.min;
  input.max = rango.max;
  wrap.appendChild(input);

  // El aviso solo aparece con una fecha futura, y dice la consecuencia, no
  // la mecánica: lo que el admin necesita saber es dónde va a ver a ese
  // alumno y dónde no.
  const nota = document.createElement("div");
  nota.className = "ac-field-hint";
  wrap.appendChild(nota);

  function refrescar() {
    const valor = input.value;
    // El dedazo se avisa ANTES que la consecuencia: con un año imposible, el
    // "saldrá en el Diario a partir del..." sería contar lo que va a pasar
    // con una fecha que no se va a poder guardar.
    const motivo = motivoFechaIrrazonable(valor, hoy);
    if (motivo) {
      nota.textContent = motivo;
      nota.className = "ac-field-hint ac-field-hint--error";
      nota.hidden = false;
      return;
    }
    nota.className = "ac-field-hint";
    const esFutura = Boolean(valor) && valor > hoy;
    nota.textContent = esFutura
      ? `Saldrá en el cuadrante desde ya, y en el Diario a partir del ${formatFechaEs(valor)}.`
      : "";
    nota.hidden = !esFutura;
  }
  input.addEventListener("change", refrescar);
  input.addEventListener("input", refrescar);
  refrescar();

  return {
    wrap,
    // Se devuelve siempre, también cuando es hoy: el backend trata
    // "ausente" como hoy, así que mandarla explícita no cambia nada y evita
    // que el valor dependa de cuál de los dos relojes va por delante.
    getValue: () => input.value || hoy,
    // Que el drawer pueda negarse a guardar, igual que con el IBAN de la
    // familia: una fecha de inicio imposible no se ve venir —el alumno
    // simplemente deja de salir en el Diario— así que este es el único
    // momento en que se puede avisar.
    esValida: () => fechaRazonable(input.value, hoy),
    motivoInvalido: () => motivoFechaIrrazonable(input.value, hoy),
  };
}
