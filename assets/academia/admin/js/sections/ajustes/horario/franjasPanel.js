import { buildPanelHead, buildPanelFoot } from "../panelChrome.js";
import { filasDeRejillaDeConfig, celdasPorClase, PASO_MIN } from "../../../../../../shared/js/horarioTramos.js";

// Horario de apertura del centro. De aquí sale la rejilla con la que se
// asigna el horario de cada alumno.
//
// QUÉ CAMBIÓ Y POR QUÉ. Antes este panel editaba "franjas": apertura,
// cierre y duración, y enseñaba debajo la lista de tramos que salían de
// esos tres números (15:30→16:30, 16:30→17:30…). Esa lista no era una
// vista previa inofensiva: era la promesa de que un alumno solo podía
// entrar a esas horas, y por eso una alumna que solo podía de 16:00 a 17:00
// no cabía en ninguna parte.
//
// Ahora la rejilla va SIEMPRE de media en media hora (ver horarioTramos.js)
// y una clase se forma juntando casillas. Así que aquí solo se decide
// CUÁNDO ABRE el centro —lo único que de verdad limita el horario— y
// cuánto dura la clase estándar, que es lo que se marca de un clic.
//
// Y se admite JORNADA PARTIDA (migración 111): un centro de 9:00 a 14:00 y
// de 16:00 a 21:00 tenía que elegir entre arrastrar doce filas muertas del
// mediodía en cada rejilla o no poder meter las clases de la mañana.

const JORNADA_CONTINUA = "continua";
const JORNADA_PARTIDA = "partida";

function buildCampoHora(label, valor) {
  const wrap = document.createElement("div");
  wrap.className = "ac-field";
  const lab = document.createElement("label");
  lab.className = "ac-label";
  lab.textContent = label;
  const input = document.createElement("input");
  input.type = "time";
  input.className = "ac-time-input";
  input.value = valor || "";
  wrap.append(lab, input);
  return { wrap, input };
}

// Las horas reales de la rejilla, en fila y compactas. Antes esto era una
// lista de tramos de la duración configurada, que se leía como "estas son
// las únicas horas de entrada posibles" — justo lo que ya no es verdad.
export function buildRejillaPreview(config) {
  const wrap = document.createElement("div");
  const horas = filasDeRejillaDeConfig(config);

  const explicacion = document.createElement("p");
  explicacion.className = "ac-foot-hint";
  if (!horas.length) {
    explicacion.textContent = "Ninguna hora con estos valores — revisa la apertura y el cierre.";
    wrap.appendChild(explicacion);
    return wrap;
  }
  const casillas = celdasPorClase(config.franja_duracion);
  explicacion.textContent =
    `La rejilla va de ${PASO_MIN} en ${PASO_MIN} minutos. Una clase estándar de ${config.franja_duracion} min ` +
    `son ${casillas} ${casillas === 1 ? "casilla" : "casillas"}: se marcan de un clic y se pueden alargar o ` +
    "recortar media hora al asignar el horario de cada alumno.";
  wrap.appendChild(explicacion);

  const chips = document.createElement("div");
  chips.className = "ac-franja-horas";
  chips.style.display = "flex";
  chips.style.flexWrap = "wrap";
  chips.style.gap = "6px";
  chips.style.marginTop = "8px";
  for (const hora of horas) {
    const chip = document.createElement("span");
    chip.className = "ac-time-input";
    chip.style.textAlign = "center";
    chip.textContent = hora;
    chips.appendChild(chip);
  }
  wrap.appendChild(chips);
  return wrap;
}

function tramosIguales(a, b) {
  return a.length === b.length && a.every((h, i) => h === b[i]);
}

export function buildFranjasPanel({ fetchConfigFn, updateConfigFn, fetchImpactoHorarioFn, confirmFn }) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";
  panel.appendChild(buildPanelHead(
    "Horario de apertura",
    "Cuándo abre la academia. De aquí sale la rejilla con la que se asigna el horario de cada alumno."
  ));

  const msgEl = document.createElement("span");
  msgEl.className = "ac-drawer-msg";
  panel.appendChild(msgEl);

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  panel.appendChild(cargando);

  function renderContenido(config) {
    cargando.remove();

    let guardado = {
      franja_inicio: config.franja_inicio || "15:30",
      franja_fin: config.franja_fin || "20:30",
      franja_inicio_2: config.franja_inicio_2 || null,
      franja_fin_2: config.franja_fin_2 || null,
      franja_duracion: Number(config.franja_duracion) || 60,
    };

    const jornadaSel = document.createElement("select");
    jornadaSel.className = "ac-select";
    for (const [value, label] of [
      [JORNADA_CONTINUA, "Jornada continua (un tramo)"],
      [JORNADA_PARTIDA, "Jornada partida (mañana y tarde)"],
    ]) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      jornadaSel.appendChild(opt);
    }
    jornadaSel.value = guardado.franja_inicio_2 ? JORNADA_PARTIDA : JORNADA_CONTINUA;
    const jornadaCampo = document.createElement("div");
    jornadaCampo.className = "ac-field";
    const jornadaLabel = document.createElement("label");
    jornadaLabel.className = "ac-label";
    jornadaLabel.textContent = "Jornada";
    jornadaCampo.append(jornadaLabel, jornadaSel);
    panel.appendChild(jornadaCampo);

    const primero = document.createElement("div");
    primero.className = "ac-field-row three";
    const apertura = buildCampoHora("Apertura", guardado.franja_inicio);
    const cierre = buildCampoHora("Cierre", guardado.franja_fin);

    const duracionCampo = document.createElement("div");
    duracionCampo.className = "ac-field";
    const duracionLabel = document.createElement("label");
    duracionLabel.className = "ac-label";
    duracionLabel.textContent = "Clase estándar (min)";
    const duracionInput = document.createElement("input");
    duracionInput.type = "number";
    duracionInput.className = "ac-input";
    duracionInput.min = "15";
    duracionInput.max = "240";
    duracionInput.step = "5";
    duracionInput.value = String(guardado.franja_duracion);
    duracionCampo.append(duracionLabel, duracionInput);

    primero.append(apertura.wrap, cierre.wrap, duracionCampo);
    panel.appendChild(primero);

    // Segundo tramo: solo visible en jornada partida. Se construye siempre
    // (no se destruye al cambiar de modo) para que alternar entre continua y
    // partida no borre lo que el admin ya había escrito.
    const segundo = document.createElement("div");
    segundo.className = "ac-field-row three";
    const apertura2 = buildCampoHora("Apertura (tarde)", guardado.franja_inicio_2 || "16:00");
    const cierre2 = buildCampoHora("Cierre (tarde)", guardado.franja_fin_2 || "21:00");
    segundo.append(apertura2.wrap, cierre2.wrap);
    panel.appendChild(segundo);

    const previewSlot = document.createElement("div");
    previewSlot.style.marginTop = "10px";
    panel.appendChild(previewSlot);

    const { foot, hint } = buildPanelFoot("");

    function esPartida() {
      return jornadaSel.value === JORNADA_PARTIDA;
    }

    // Lo que se guardaría ahora mismo. Un solo sitio del que leen la vista
    // previa, el aviso de huérfanos y el guardado: si cada uno compusiera
    // su propio objeto, acabarían diciendo cosas distintas.
    function valores() {
      return {
        franja_inicio: apertura.input.value,
        franja_fin: cierre.input.value,
        franja_inicio_2: esPartida() ? apertura2.input.value : null,
        franja_fin_2: esPartida() ? cierre2.input.value : null,
        franja_duracion: Number(duracionInput.value),
      };
    }

    function actualizarVista() {
      segundo.classList.toggle("hidden", !esPartida());
      previewSlot.innerHTML = "";
      previewSlot.appendChild(buildRejillaPreview(valores()));
      const n = filasDeRejillaDeConfig(valores()).length;
      hint.textContent = `${n} ${n === 1 ? "media hora" : "medias horas"} de apertura`;
    }
    actualizarVista();
    for (const input of [apertura.input, cierre.input, apertura2.input, cierre2.input, duracionInput]) {
      input.addEventListener("input", actualizarVista);
    }
    jornadaSel.addEventListener("change", actualizarVista);

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ac-btn primary";
    saveBtn.textContent = "Guardar";
    saveBtn.addEventListener("click", onGuardar);
    foot.appendChild(saveBtn);
    panel.appendChild(foot);

    async function onGuardar() {
      msgEl.textContent = "";
      const nuevo = valores();

      // Solo el horario de apertura puede dejar clases fuera de la rejilla;
      // cambiar la duración estándar ya no descoloca nada (ver
      // horarioTramos.js), así que no tiene sentido avisar por eso.
      const cambiaronTramos = !tramosIguales(
        filasDeRejillaDeConfig(guardado),
        filasDeRejillaDeConfig(nuevo)
      );

      saveBtn.disabled = true;
      try {
        if (cambiaronTramos) {
          const huerfanos = await fetchImpactoHorarioFn(nuevo);
          if (huerfanos > 0) {
            const clase = huerfanos === 1 ? "clase asignada dejaría" : "clases asignadas dejarían";
            const pregunta = `${huerfanos} ${clase} de aparecer en el horario. ¿Guardar de todas formas?`;
            if (!confirmFn(pregunta)) {
              saveBtn.disabled = false;
              return;
            }
          }
        }

        await updateConfigFn(nuevo);
        guardado = nuevo;
        msgEl.textContent = "✓ Guardado";
        msgEl.className = "ac-drawer-msg ok";
      } catch (err) {
        msgEl.textContent = err.message || "No se pudo guardar.";
        msgEl.className = "ac-drawer-msg error";
      } finally {
        saveBtn.disabled = false;
      }
    }
  }

  fetchConfigFn()
    .then((config) => renderContenido(config || {}))
    .catch((err) => {
      cargando.textContent = err.message || "No se pudo cargar la configuración.";
      cargando.className = "ac-error";
    });

  return panel;
}
