import { fetchModeloFiscal, guardarTrimestreFiscal, fetchGastosTrimestre } from "../../../apiFinanzas.js";
import { buildCasillaEditable, buildCasillaCalculada, formatEuros } from "./casillaRow.js";
import { buildBannerResultado } from "./bannerResultado.js";
import { buildModeloCard, buildSeccionHead } from "./fiscalForm.js";
import { buildAnexoGastosHtml } from "./print/anexosHtml.js";
import { imprimirModeloActual } from "./print/imprimirModeloActual.js";
import { buildFilaDescargarPdf } from "./print/botonesImpresion.js";
import { buildNotaDiscreta } from "./notaDiscreta.js";

const MODELO = "130";

// Modelo 130 — IRPF estimación directa, pago fraccionado trimestral.
// [01]/[02] arrancan con los ingresos/gastos reales del trimestre (o lo
// que haya guardado ya el admin); todas las casillas son "calculada pero
// editable" salvo [06] — si el admin escribe sobre una, el resto de la
// cascada (03 lee 01/02, 04 lee 03, 07 lee 04 y 06) usa lo que esa casilla
// muestre, sea el cálculo automático o lo que el admin haya puesto. El
// botón "Descargar PDF" vive justo debajo de la barra "A ingresar".
export function renderModelo130(container, { anio, trimestre, fetchModeloFiscalFn = fetchModeloFiscal, guardarTrimestreFiscalFn = guardarTrimestreFiscal, fetchGastosTrimestreFn = fetchGastosTrimestre }) {
  container.innerHTML = "";
  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  container.appendChild(cargando);

  return fetchModeloFiscalFn(MODELO, { anio, trimestre })
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

      // QUÉ ES EL NÚMERO QUE PROPONE LA CASILLA [01], dicho antes de que
      // nadie lo firme. Sale de los recibos COBRADOS (criterio de caja, ver
      // ingresosDelPeriodo.js en el backend) y la casilla es editable: si el
      // gestor dice devengo, el que tiene que cambiarlo es Jorge, y para eso
      // necesita saber cuánto hay emitido sin cobrar. Con 2.388 € emitidos y
      // 0 cobrados, esta casilla proponía 0 € sin decir nada.
      const notas = [];
      const pendiente = Number(calculado.pendiente_de_cobro || 0);
      if (pendiente > 0) {
        notas.push(buildNotaDiscreta(
          `[01] propone lo COBRADO en el trimestre (${formatEuros(calculado.ingresos)}). `
          + `Emitido: ${formatEuros(calculado.facturado || 0)} · sin cobrar todavía: ${formatEuros(pendiente)}. `
          + "Si tu criterio es devengo, la casilla es editable."
        ));
      }
      if (calculado.gastos_registrados === 0) {
        notas.push(buildNotaDiscreta(
          "No hay ningún gasto registrado en este trimestre, así que [02] va a 0 € y el rendimiento neto sale sin descontar nada."
        ));
      }

      const formCard = buildModeloCard([
        ...notas,
        buildSeccionHead("ACTIVIDADES EN ESTIMACIÓN DIRECTA"),
        casilla01.row, casilla02.row,
        buildSeccionHead("LIQUIDACIÓN"),
        casilla03.row, casilla04.row, casilla06.row, casilla07.row,
      ]);

      async function imprimir() {
        const gastos = await fetchGastosTrimestreFn({ anio, trimestre });
        await imprimirModeloActual({
          container, formCard, banner,
          titulo: `Modelo 130 — T${trimestre} ${anio}`,
          anexoHtml: buildAnexoGastosHtml(gastos),
        });
      }
      container.append(formCard, banner, buildFilaDescargarPdf(imprimir));
    })
    .catch((err) => {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar el Modelo 130.";
      container.appendChild(p);
    });
}
