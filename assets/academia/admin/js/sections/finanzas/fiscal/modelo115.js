import { fetchModeloFiscal, guardarTrimestreFiscal } from "../../../apiFinanzas.js";
import { buildCasillaEditable, buildCasillaCalculada, buildCasillaSoloLectura, formatEuros } from "./casillaRow.js";
import { buildBannerResultado } from "./bannerResultado.js";
import { buildModeloCard, buildSeccionHead } from "./fiscalForm.js";
import { buildAnexoAlquilerHtml } from "./print/anexosHtml.js";
import { imprimirModeloActual } from "./print/imprimirModeloActual.js";

const MODELO = "115";
const IVA_PCT = 21;
const RETENCION_PCT_DEFECTO = 19;

// Modelo 115 — retención de alquileres (autónomo y sociedad). Lo editable
// es el % de retención (no su importe en €) — mismo patrón que el % de
// Modelo 111 — así que el importe resultante es de solo lectura, no una
// casilla "calculada pero sobrescribible" como el resto. IVA/total y la
// sección trimestral siguen siendo calculadas-pero-editables. Devuelve
// { imprimir } para el botón compartido junto al selector de período.
export function renderModelo115(container, { anio, trimestre, fetchModeloFiscalFn = fetchModeloFiscal, guardarTrimestreFiscalFn = guardarTrimestreFiscal }) {
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

      const campoBase = buildCasillaEditable(null, "Base mensual alquiler", { valorInicial: editable.base_mensual ?? 0, attrs: { min: "0", step: "0.01" } });
      const casillaIva = buildCasillaCalculada(null, `IVA ${IVA_PCT}%`, { valorInicialOverride: overrides.iva ?? null });
      const campoRetencionPct = buildCasillaEditable(null, "Retención", { unidad: "%", valorInicial: editable.retencion_pct ?? RETENCION_PCT_DEFECTO, attrs: { min: "0", max: "100", step: "0.5" } });
      const casillaRetencionImporte = buildCasillaSoloLectura(null, "Importe retención");
      const casillaTotal = buildCasillaCalculada(null, "Total a pagar propietario", { valorInicialOverride: overrides.total ?? null });
      const casillaBaseTrim = buildCasillaCalculada(null, "Base trimestral (× 3)", { valorInicialOverride: overrides.base_trimestral ?? null });
      const casillaRetencionTrim = buildCasillaCalculada(null, "Retención trimestral (× 3)", { valorInicialOverride: overrides.retencion_trimestral ?? null });
      const { banner: bannerResultado, val: bannerVal } = buildBannerResultado(`A ingresar · M115 T${trimestre} ${anio}`, "");

      function refrescar() {
        const base = Number(campoBase.input.value) || 0;
        const retencionPct = Number(campoRetencionPct.input.value) || 0;
        casillaIva.setComputed(base * (IVA_PCT / 100));
        const retencionImporte = base * (retencionPct / 100);
        casillaRetencionImporte.val.textContent = formatEuros(retencionImporte);
        casillaTotal.setComputed(base + casillaIva.getValue() - retencionImporte);
        casillaBaseTrim.setComputed(base * 3);
        casillaRetencionTrim.setComputed(retencionImporte * 3);
        bannerVal.textContent = formatEuros(casillaRetencionTrim.getValue());
      }

      async function guardar() {
        const datosGuardar = {
          editable: {
            base_mensual: Number(campoBase.input.value) || 0,
            retencion_pct: Number(campoRetencionPct.input.value) || 0,
          },
          overrides: {},
        };
        if (casillaIva.isOverridden()) datosGuardar.overrides.iva = casillaIva.getValue();
        if (casillaTotal.isOverridden()) datosGuardar.overrides.total = casillaTotal.getValue();
        if (casillaBaseTrim.isOverridden()) datosGuardar.overrides.base_trimestral = casillaBaseTrim.getValue();
        if (casillaRetencionTrim.isOverridden()) datosGuardar.overrides.retencion_trimestral = casillaRetencionTrim.getValue();
        try {
          await guardarTrimestreFiscalFn({ modelo: MODELO, anio, trimestre, datos: datosGuardar });
        } catch (err) {
          window.alert(err.message || "No se pudo guardar el Modelo 115.");
        }
      }

      const inputs = [campoBase.input, campoRetencionPct.input, casillaIva.input, casillaTotal.input, casillaBaseTrim.input, casillaRetencionTrim.input];
      for (const input of inputs) {
        input.addEventListener("input", refrescar);
        input.addEventListener("blur", guardar);
      }
      refrescar();

      const formCard = buildModeloCard([
        buildSeccionHead("RETENCIÓN DE ALQUILERES"),
        campoBase.row, casillaIva.row, campoRetencionPct.row, casillaRetencionImporte.row, casillaTotal.row,
        buildSeccionHead("TRIMESTRAL"),
        casillaBaseTrim.row, casillaRetencionTrim.row,
      ]);
      container.append(formCard, bannerResultado);

      async function imprimir() {
        const base = Number(campoBase.input.value) || 0;
        const retencionPct = Number(campoRetencionPct.input.value) || 0;
        const retencionImporte = base * (retencionPct / 100);
        await imprimirModeloActual({
          container, formCard, banner: bannerResultado,
          titulo: `Modelo 115 — T${trimestre} ${anio}`,
          anexoHtml: buildAnexoAlquilerHtml({
            base, iva: casillaIva.getValue(), retencion: retencionImporte,
            total: casillaTotal.getValue(), baseTrim: casillaBaseTrim.getValue(), retencionTrim: casillaRetencionTrim.getValue(),
          }),
        });
      }
      return { imprimir };
    })
    .catch((err) => {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar el Modelo 115.";
      container.appendChild(p);
      return null;
    });
}
