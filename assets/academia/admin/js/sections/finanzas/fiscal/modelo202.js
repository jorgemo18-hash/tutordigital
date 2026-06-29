import { fetchModeloFiscal, guardarTrimestreFiscal } from "../../../apiFinanzas.js";
import { buildCasillaEditable, buildCasillaCalculada, formatEuros } from "./casillaRow.js";
import { buildBannerResultado } from "./bannerResultado.js";
import { buildModeloCard, buildSeccionHead } from "./fiscalForm.js";
import { imprimirModeloActual } from "./print/imprimirModeloActual.js";
import { buildFilaDescargarPdf } from "./print/botonesImpresion.js";

const MODELO = "202";

// Modelo 202 — pago fraccionado del Impuesto de Sociedades (solo tenants
// con regimen_fiscal='sociedad'). A diferencia del 130, no depende de
// Ingresos/Gastos reales — [01]/[02]/[04] son puramente lo que escriba el
// admin, así que no hace falta nada del backend salvo lo ya guardado.
// Sin anexo en el PDF (no se pidió ninguno para este modelo). El botón
// "Descargar PDF" vive justo debajo de la barra "A ingresar".
export function renderModelo202(container, { anio, trimestre, fetchModeloFiscalFn = fetchModeloFiscal, guardarTrimestreFiscalFn = guardarTrimestreFiscal }) {
  container.innerHTML = "";
  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  container.appendChild(cargando);

  return fetchModeloFiscalFn(MODELO, { anio, trimestre })
    .then((datos) => {
      container.innerHTML = "";
      const overrides = datos.overrides || {};
      const editable = datos.editable || {};

      const casilla01 = buildCasillaEditable("01", "Base imponible del período", { valorInicial: editable.base_imponible ?? 0, attrs: { min: "0", step: "0.01" } });
      const casilla02 = buildCasillaEditable("02", "Tipo de gravamen", { unidad: "%", valorInicial: editable.tipo_gravamen ?? 25, attrs: { min: "0", max: "100", step: "0.5" } });
      const casilla03 = buildCasillaCalculada("03", "Cuota íntegra", { valorInicialOverride: overrides.cuota_integra ?? null });
      const casilla04 = buildCasillaEditable("04", "Pagos fraccionados anteriores del ejercicio", { valorInicial: editable.pagos_fraccionados_anteriores ?? 0, attrs: { min: "0", step: "0.01" } });
      const casilla05 = buildCasillaCalculada("05", "Resultado", { valorInicialOverride: overrides.resultado ?? null });
      const { banner, val: bannerVal } = buildBannerResultado(`A ingresar · M202 T${trimestre} ${anio}`, "");

      function refrescar() {
        const baseImponible = Number(casilla01.input.value) || 0;
        const tipoGravamen = Number(casilla02.input.value) || 0;
        casilla03.setComputed(baseImponible * (tipoGravamen / 100));
        const pagosAnteriores = Number(casilla04.input.value) || 0;
        casilla05.setComputed(casilla03.getValue() - pagosAnteriores);
        bannerVal.textContent = formatEuros(casilla05.getValue());
      }

      async function guardar() {
        const datosGuardar = {
          editable: {
            base_imponible: Number(casilla01.input.value) || 0,
            tipo_gravamen: Number(casilla02.input.value) || 0,
            pagos_fraccionados_anteriores: Number(casilla04.input.value) || 0,
          },
          overrides: {},
        };
        if (casilla03.isOverridden()) datosGuardar.overrides.cuota_integra = casilla03.getValue();
        if (casilla05.isOverridden()) datosGuardar.overrides.resultado = casilla05.getValue();
        try {
          await guardarTrimestreFiscalFn({ modelo: MODELO, anio, trimestre, datos: datosGuardar });
        } catch (err) {
          window.alert(err.message || "No se pudo guardar el Modelo 202.");
        }
      }

      const inputs = [casilla01.input, casilla02.input, casilla03.input, casilla04.input, casilla05.input];
      for (const input of inputs) {
        input.addEventListener("input", refrescar);
        input.addEventListener("blur", guardar);
      }
      refrescar();

      const formCard = buildModeloCard([
        buildSeccionHead("PAGO FRACCIONADO IS"),
        casilla01.row, casilla02.row, casilla03.row, casilla04.row, casilla05.row,
      ]);

      async function imprimir() {
        await imprimirModeloActual({
          container, formCard, banner,
          titulo: `Modelo 202 — T${trimestre} ${anio}`,
          anexoHtml: "",
        });
      }
      container.append(formCard, banner, buildFilaDescargarPdf(imprimir));
    })
    .catch((err) => {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar el Modelo 202.";
      container.appendChild(p);
    });
}
