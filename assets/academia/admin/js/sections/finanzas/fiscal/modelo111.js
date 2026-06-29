import { fetchModeloFiscal, guardarTrimestreFiscal } from "../../../apiFinanzas.js";
import { buildCasillaEditable, buildCasillaCalculada, formatEuros } from "./casillaRow.js";
import { buildBannerResultado } from "./bannerResultado.js";
import { buildModeloCard, buildSeccionHead } from "./fiscalForm.js";
import { buildAnexoNominasHtml } from "./print/anexosHtml.js";
import { imprimirModeloActual } from "./print/imprimirModeloActual.js";

const MODELO = "111";

// Modelo 111 — retención de trabajadores (autónomo y sociedad). Base y %
// son puramente editables; la retención trimestral es calculada pero
// sobrescribible. Sin sección anual — el Modelo 190 se retiró de este
// diseño. Devuelve { imprimir } para el botón compartido junto al
// selector de período.
export function renderModelo111(container, { anio, trimestre, fetchModeloFiscalFn = fetchModeloFiscal, guardarTrimestreFiscalFn = guardarTrimestreFiscal }) {
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

      const campoBase = buildCasillaEditable(null, "Base trimestral nóminas", { valorInicial: editable.base_trimestral ?? 0, attrs: { min: "0", step: "0.01" } });
      const campoRetencionPct = buildCasillaEditable(null, "Retención", { unidad: "%", valorInicial: editable.retencion_pct ?? 15, attrs: { min: "0", max: "100", step: "0.5" } });
      const casillaRetencion = buildCasillaCalculada(null, "Retención trimestral", { valorInicialOverride: overrides.retencion_trimestral ?? null });
      const { banner: bannerResultado, val: bannerVal } = buildBannerResultado(`A ingresar · M111 T${trimestre} ${anio}`, "");

      function refrescar() {
        const base = Number(campoBase.input.value) || 0;
        const retencionPct = Number(campoRetencionPct.input.value) || 0;
        casillaRetencion.setComputed(base * (retencionPct / 100));
        bannerVal.textContent = formatEuros(casillaRetencion.getValue());
      }

      async function guardar() {
        const datosGuardar = {
          editable: {
            base_trimestral: Number(campoBase.input.value) || 0,
            retencion_pct: Number(campoRetencionPct.input.value) || 0,
          },
          overrides: {},
        };
        if (casillaRetencion.isOverridden()) datosGuardar.overrides.retencion_trimestral = casillaRetencion.getValue();
        try {
          await guardarTrimestreFiscalFn({ modelo: MODELO, anio, trimestre, datos: datosGuardar });
        } catch (err) {
          window.alert(err.message || "No se pudo guardar el Modelo 111.");
        }
      }

      const inputs = [campoBase.input, campoRetencionPct.input, casillaRetencion.input];
      for (const input of inputs) {
        input.addEventListener("input", refrescar);
        input.addEventListener("blur", guardar);
      }
      refrescar();

      const formCard = buildModeloCard([
        buildSeccionHead("DATOS DE NÓMINAS"),
        campoBase.row, campoRetencionPct.row, casillaRetencion.row,
      ]);
      container.append(formCard, bannerResultado);

      async function imprimir() {
        await imprimirModeloActual({
          container, formCard, banner: bannerResultado,
          titulo: `Modelo 111 — T${trimestre} ${anio}`,
          anexoHtml: buildAnexoNominasHtml({
            baseTrimestral: Number(campoBase.input.value) || 0,
            retencionPct: Number(campoRetencionPct.input.value) || 0,
            retencionTrimestral: casillaRetencion.getValue(),
          }),
        });
      }
      return { imprimir };
    })
    .catch((err) => {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar el Modelo 111.";
      container.appendChild(p);
      return null;
    });
}
