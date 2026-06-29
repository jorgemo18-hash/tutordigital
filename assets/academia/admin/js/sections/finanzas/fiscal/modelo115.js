import { fetchModeloFiscal, guardarTrimestreFiscal } from "../../../apiFinanzas.js";
import { buildCasillaEditable, buildCasillaCalculada, formatEuros } from "./casillaRow.js";
import { buildBannerResultado } from "./bannerResultado.js";
import { buildModeloCard, buildSeccionHead } from "./fiscalForm.js";

const MODELO = "115";
const IVA_PCT = 21;
const RETENCION_PCT = 19;

// Modelo 115 — retención de alquileres (autónomo y sociedad). Solo la
// base mensual es puramente editable; IVA/retención/total y la sección
// trimestral son calculadas pero el admin puede sobrescribir cualquiera
// (igual que el resto de modelos). Sin sección anual — el Modelo 180 se
// retiró de este diseño.
export function renderModelo115(container, { anio, trimestre, fetchModeloFiscalFn = fetchModeloFiscal, guardarTrimestreFiscalFn = guardarTrimestreFiscal }) {
  container.innerHTML = "";
  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  container.appendChild(cargando);

  fetchModeloFiscalFn(MODELO, { anio, trimestre })
    .then((datos) => {
      container.innerHTML = "";
      const overrides = datos.overrides || {};
      const baseMensualInicial = datos.editable?.base_mensual ?? 0;

      const campoBase = buildCasillaEditable(null, "Base mensual alquiler", { valorInicial: baseMensualInicial, attrs: { min: "0", step: "0.01" } });
      const casillaIva = buildCasillaCalculada(null, `IVA ${IVA_PCT}%`, { valorInicialOverride: overrides.iva ?? null });
      const casillaRetencion = buildCasillaCalculada(null, `Retención ${RETENCION_PCT}%`, { valorInicialOverride: overrides.retencion ?? null });
      const casillaTotal = buildCasillaCalculada(null, "Total a pagar propietario", { valorInicialOverride: overrides.total ?? null });
      const casillaBaseTrim = buildCasillaCalculada(null, "Base trimestral (× 3)", { valorInicialOverride: overrides.base_trimestral ?? null });
      const casillaRetencionTrim = buildCasillaCalculada(null, "Retención trimestral (× 3)", { valorInicialOverride: overrides.retencion_trimestral ?? null });
      const { banner: bannerResultado, val: bannerVal } = buildBannerResultado(`A ingresar · M115 T${trimestre} ${anio}`, "");

      function refrescar() {
        const base = Number(campoBase.input.value) || 0;
        casillaIva.setComputed(base * (IVA_PCT / 100));
        casillaRetencion.setComputed(base * (RETENCION_PCT / 100));
        casillaTotal.setComputed(base + casillaIva.getValue() - casillaRetencion.getValue());
        casillaBaseTrim.setComputed(base * 3);
        casillaRetencionTrim.setComputed(casillaRetencion.getValue() * 3);
        bannerVal.textContent = formatEuros(casillaRetencionTrim.getValue());
      }

      async function guardar() {
        const datosGuardar = { editable: { base_mensual: Number(campoBase.input.value) || 0 }, overrides: {} };
        if (casillaIva.isOverridden()) datosGuardar.overrides.iva = casillaIva.getValue();
        if (casillaRetencion.isOverridden()) datosGuardar.overrides.retencion = casillaRetencion.getValue();
        if (casillaTotal.isOverridden()) datosGuardar.overrides.total = casillaTotal.getValue();
        if (casillaBaseTrim.isOverridden()) datosGuardar.overrides.base_trimestral = casillaBaseTrim.getValue();
        if (casillaRetencionTrim.isOverridden()) datosGuardar.overrides.retencion_trimestral = casillaRetencionTrim.getValue();
        try {
          await guardarTrimestreFiscalFn({ modelo: MODELO, anio, trimestre, datos: datosGuardar });
        } catch (err) {
          window.alert(err.message || "No se pudo guardar el Modelo 115.");
        }
      }

      const inputs = [campoBase.input, casillaIva.input, casillaRetencion.input, casillaTotal.input, casillaBaseTrim.input, casillaRetencionTrim.input];
      for (const input of inputs) {
        input.addEventListener("input", refrescar);
        input.addEventListener("blur", guardar);
      }
      refrescar();

      container.appendChild(buildModeloCard([
        buildSeccionHead("RETENCIÓN DE ALQUILERES"),
        campoBase.row, casillaIva.row, casillaRetencion.row, casillaTotal.row,
        buildSeccionHead("TRIMESTRAL"),
        casillaBaseTrim.row, casillaRetencionTrim.row,
      ]));
      container.appendChild(bannerResultado);
    })
    .catch((err) => {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar el Modelo 115.";
      container.appendChild(p);
    });
}
