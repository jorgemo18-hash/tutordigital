import { fetchModeloFiscal, guardarTrimestreFiscal } from "../../../apiFinanzas.js";
import { buildCasillaEditable, buildCasillaCalculada, formatEuros } from "./casillaRow.js";
import { buildBannerResultado } from "./bannerResultado.js";
import { buildModeloCard, buildSeccionHead } from "./fiscalForm.js";

const MODELO = "130";

// Modelo 130 — IRPF estimación directa, pago fraccionado trimestral.
// [01]/[02] arrancan con los ingresos/gastos reales del trimestre (o lo
// que haya guardado ya el admin); todas las casillas son "calculada pero
// editable" salvo [06] — si el admin escribe sobre una, el resto de la
// cascada (03 lee 01/02, 04 lee 03, 07 lee 04 y 06) usa lo que esa casilla
// muestre, sea el cálculo automático o lo que el admin haya puesto.
export function renderModelo130(container, { anio, trimestre, fetchModeloFiscalFn = fetchModeloFiscal, guardarTrimestreFiscalFn = guardarTrimestreFiscal }) {
  container.innerHTML = "";
  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  container.appendChild(cargando);

  fetchModeloFiscalFn(MODELO, { anio, trimestre })
    .then((datos) => {
      container.innerHTML = "";
      const overrides = datos.overrides || {};
      const calculado = datos.calculado || { ingresos: 0, gastos_deducibles: 0 };

      const casilla01 = buildCasillaCalculada("01", "Ingresos computables del período", { valorInicialOverride: overrides.ingresos ?? null });
      const casilla02 = buildCasillaCalculada("02", "Gastos fiscalmente deducibles", { valorInicialOverride: overrides.gastos_deducibles ?? null });
      const casilla03 = buildCasillaCalculada("03", "Rendimiento neto", { valorInicialOverride: overrides.rendimiento_neto ?? null });
      const casilla04 = buildCasillaCalculada("04", "20% de la casilla 03", { valorInicialOverride: overrides.veinte_pct ?? null });
      const casilla06 = buildCasillaEditable("06", "Minoración", { valorInicial: datos.editable?.minoracion ?? 0, attrs: { min: "0", step: "0.01" } });
      const casilla07 = buildCasillaCalculada("07", "Resultado", { valorInicialOverride: overrides.resultado ?? null });
      const { banner, val: bannerVal } = buildBannerResultado(`A ingresar · M130 T${trimestre} ${anio}`, "");

      function refrescar() {
        casilla01.setComputed(calculado.ingresos);
        casilla02.setComputed(calculado.gastos_deducibles);
        const rendimientoNeto = casilla01.getValue() - casilla02.getValue();
        casilla03.setComputed(rendimientoNeto);
        const veintePct = Math.max(0, casilla03.getValue() * 0.2);
        casilla04.setComputed(veintePct);
        const minoracion = Number(casilla06.input.value) || 0;
        const resultado = casilla04.getValue() - minoracion;
        casilla07.setComputed(resultado);
        bannerVal.textContent = formatEuros(casilla07.getValue());
      }

      async function guardar() {
        const datosGuardar = {
          editable: { minoracion: Number(casilla06.input.value) || 0 },
          overrides: {},
          calculado,
        };
        if (casilla01.isOverridden()) datosGuardar.overrides.ingresos = casilla01.getValue();
        if (casilla02.isOverridden()) datosGuardar.overrides.gastos_deducibles = casilla02.getValue();
        if (casilla03.isOverridden()) datosGuardar.overrides.rendimiento_neto = casilla03.getValue();
        if (casilla04.isOverridden()) datosGuardar.overrides.veinte_pct = casilla04.getValue();
        if (casilla07.isOverridden()) datosGuardar.overrides.resultado = casilla07.getValue();
        try {
          await guardarTrimestreFiscalFn({ modelo: MODELO, anio, trimestre, datos: datosGuardar });
        } catch (err) {
          window.alert(err.message || "No se pudo guardar el Modelo 130.");
        }
      }

      const editables = [casilla01.input, casilla02.input, casilla03.input, casilla04.input, casilla06.input, casilla07.input];
      for (const input of editables) {
        input.addEventListener("input", refrescar);
        input.addEventListener("blur", guardar);
      }
      refrescar();

      container.appendChild(buildModeloCard([
        buildSeccionHead("ACTIVIDADES EN ESTIMACIÓN DIRECTA"),
        casilla01.row, casilla02.row,
        buildSeccionHead("LIQUIDACIÓN"),
        casilla03.row, casilla04.row, casilla06.row, casilla07.row,
      ]));
      container.appendChild(banner);
    })
    .catch((err) => {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar el Modelo 130.";
      container.appendChild(p);
    });
}
