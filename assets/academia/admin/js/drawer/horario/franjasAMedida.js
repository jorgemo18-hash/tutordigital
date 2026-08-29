import { toMinutos, toHHMM } from "../../../../../shared/js/horarioFranjas.js";
import { tramosDe } from "../../../../../shared/js/horarioTramos.js";

const NOMBRES_DIA = {
  1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves",
  5: "Viernes", 6: "Sábado", 7: "Domingo",
};

// Clases que no caben en la rejilla: a las 16:15, o de 20:00 a 21:00 en un
// centro que cierra a las 20:30. Son la excepción, pero existen — un alumno
// que solo puede a esa hora, una recuperación, una hora suelta pactada con
// una familia.
//
// Y ADEMÁS ARREGLA UNA PÉRDIDA DE DATOS QUE YA EXISTÍA: una franja cuyo
// hora_inicio no coincidía con ninguna fila de la rejilla no se pre-marcaba
// (no hay casilla que marcar), así que al guardar la ficha del alumno
// desaparecía sin decir nada. Eso es exactamente lo que contaba el aviso de
// "huérfanos" de Ajustes › Horario: clases invisibles que el siguiente
// guardado se llevaba por delante. Ahora se enseñan aquí, se conservan al
// guardar y se pueden quitar a mano si sobran.

export function encajaEnRejilla(franja, horasRejilla) {
  const horas = horasRejilla instanceof Set ? horasRejilla : new Set(horasRejilla || []);
  const tramos = tramosDe(
    String(franja?.hora_inicio || "").slice(0, 5),
    String(franja?.hora_fin || "").slice(0, 5)
  );
  return tramos.every((t) => horas.has(t));
}

// Separa el horario del alumno en lo que la rejilla puede representar y lo
// que no. Se hace en un solo sitio para que ninguna pantalla decida por su
// cuenta qué franjas "no existen".
export function repartirFranjas(horarioActual = [], horasRejilla = []) {
  const enRejilla = [];
  const aMedida = [];
  for (const f of horarioActual || []) {
    (encajaEnRejilla(f, horasRejilla) ? enRejilla : aMedida).push(f);
  }
  return { enRejilla, aMedida };
}

function normalizar(franja) {
  return {
    dia_semana: Number(franja.dia_semana),
    hora_inicio: String(franja.hora_inicio || "").slice(0, 5),
    hora_fin: String(franja.hora_fin || "").slice(0, 5),
    profesor_id: franja.profesor_id ?? null,
  };
}

function buildFila(franja, onQuitar) {
  const fila = document.createElement("div");
  fila.className = "ac-list-confirm";

  const texto = document.createElement("span");
  texto.textContent =
    `${NOMBRES_DIA[franja.dia_semana] || `Día ${franja.dia_semana}`} ${franja.hora_inicio}–${franja.hora_fin}`;

  const quitar = document.createElement("button");
  quitar.type = "button";
  quitar.className = "ac-btn ghost sm";
  quitar.textContent = "Quitar";
  quitar.addEventListener("click", () => onQuitar(franja));

  fila.append(texto, quitar);
  return fila;
}

// `dias`: [{value, label}] los días laborables del centro, los mismos que
// pinta la rejilla. `duracionPorDefecto`: la clase estándar, para no tener
// que teclearla en el caso normal.
export function buildFranjasAMedida({
  franjasIniciales = [], dias = [], duracionPorDefecto = 60, onCambio = () => {},
} = {}) {
  let franjas = franjasIniciales.map(normalizar);

  const wrap = document.createElement("div");
  wrap.style.marginTop = "10px";

  const lista = document.createElement("div");
  const formSlot = document.createElement("div");

  const abrirBtn = document.createElement("button");
  abrirBtn.type = "button";
  abrirBtn.className = "ac-btn ghost sm";
  abrirBtn.textContent = "+ Franja a medida";
  // Plegado por defecto: es la excepción, no puede competir visualmente con
  // la rejilla, que es por donde se hace el 95% de las altas.
  abrirBtn.addEventListener("click", () => {
    abrirBtn.classList.add("hidden");
    formSlot.appendChild(buildFormulario());
  });

  function render() {
    lista.innerHTML = "";
    for (const f of franjas) lista.appendChild(buildFila(f, quitar));
  }

  function quitar(franja) {
    franjas = franjas.filter((f) => f !== franja);
    render();
    onCambio();
  }

  function buildFormulario() {
    const form = document.createElement("div");
    form.className = "ac-list-confirm";

    const diaSel = document.createElement("select");
    diaSel.className = "ac-select";
    for (const dia of dias) {
      const opt = document.createElement("option");
      opt.value = String(dia.value);
      opt.textContent = NOMBRES_DIA[dia.value] || dia.label;
      diaSel.appendChild(opt);
    }

    const horaInput = document.createElement("input");
    horaInput.type = "time";
    horaInput.className = "ac-time-input";

    const duracionInput = document.createElement("input");
    duracionInput.type = "number";
    duracionInput.className = "ac-input";
    duracionInput.min = "15";
    duracionInput.step = "5";
    duracionInput.value = String(duracionPorDefecto);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "ac-btn primary sm";
    addBtn.textContent = "Añadir";

    const error = document.createElement("span");
    error.className = "ac-drawer-msg";

    addBtn.addEventListener("click", () => {
      const inicio = horaInput.value;
      const minutos = Number(duracionInput.value);
      // Se valida aquí y no al guardar: una franja sin hora o de duración
      // cero se colaría hasta el backend y volvería como un 400 sin decir
      // cuál de las franjas está mal.
      if (!inicio) {
        error.textContent = "Falta la hora de entrada.";
        error.className = "ac-drawer-msg error";
        return;
      }
      if (!(minutos > 0)) {
        error.textContent = "La duración tiene que ser mayor que cero.";
        error.className = "ac-drawer-msg error";
        return;
      }
      error.textContent = "";
      franjas = [...franjas, {
        dia_semana: Number(diaSel.value),
        hora_inicio: inicio,
        hora_fin: toHHMM(toMinutos(inicio) + minutos),
        profesor_id: null,
      }];
      horaInput.value = "";
      render();
      onCambio();
    });

    form.append(diaSel, horaInput, duracionInput, addBtn, error);
    return form;
  }

  render();
  wrap.append(lista, formSlot, abrirBtn);

  return { wrap, getFranjas: () => franjas.map(normalizar) };
}
