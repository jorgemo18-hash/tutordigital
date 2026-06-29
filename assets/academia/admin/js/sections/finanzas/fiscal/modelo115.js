import { fetchModelo115 } from "../../../apiFinanzas.js";
import { updateConfig } from "../../../api.js";
import { buildCasillaFiscal, buildCasillaEditable, formatEuros } from "./casillaRow.js";
import { buildBannerResultado } from "./bannerResultado.js";
import { buildPaperForm, buildSeccionHead } from "./fiscalForm.js";

const IVA_PCT = 21;
const RETENCION_PCT = 19;

// Modelo 115 — retención de alquileres. La base mensual es el único valor
// editable (se guarda en academia_config.alquiler_base_mensual al perder
// el foco); IVA/retención/total y las secciones trimestral y anual
// (Modelo 180) son derivados, siempre recalculados en el cliente.
export function renderModelo115(container, { anio, trimestre, fetchModelo115Fn = fetchModelo115, updateConfigFn = updateConfig }) {
  container.innerHTML = "";
  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  container.appendChild(cargando);

  fetchModelo115Fn({ anio, trimestre })
    .then((baseMensualInicial) => {
      container.innerHTML = "";

      const campoBase = buildCasillaEditable(null, "Base mensual alquiler", {
        valorInicial: baseMensualInicial, attrs: { min: "0", step: "0.01" },
      });
      const casillaIva = buildCasillaFiscal(null, `IVA ${IVA_PCT}%`, { calculada: true });
      const casillaRetencion = buildCasillaFiscal(null, `Retención ${RETENCION_PCT}%`, { calculada: true });
      const casillaTotal = buildCasillaFiscal(null, "Total a pagar propietario", { calculada: true });
      const casillaBaseTrim = buildCasillaFiscal(null, "Base trimestral (× 3)", { calculada: true });
      const casillaRetencionTrim = buildCasillaFiscal(null, "Retención trimestral (× 3)", { calculada: true });
      const { banner: bannerResultado, val: bannerVal } = buildBannerResultado(`A ingresar · M115 T${trimestre} ${anio}`, "");
      const casillaBaseAnual = buildCasillaFiscal(null, "Base anual (× 12)", { calculada: true });
      const casillaRetencionAnual = buildCasillaFiscal(null, "Total retenido anual", { calculada: true });

      function refrescar() {
        const base = Number(campoBase.input.value) || 0;
        const iva = Math.round(base * (IVA_PCT / 100) * 100) / 100;
        const retencion = Math.round(base * (RETENCION_PCT / 100) * 100) / 100;
        const total = base + iva - retencion;
        const retencionTrim = retencion * 3;

        casillaIva.val.textContent = formatEuros(iva);
        casillaRetencion.val.textContent = formatEuros(retencion);
        casillaTotal.val.textContent = formatEuros(total);
        casillaBaseTrim.val.textContent = formatEuros(base * 3);
        casillaRetencionTrim.val.textContent = formatEuros(retencionTrim);
        bannerVal.textContent = formatEuros(retencionTrim);
        casillaBaseAnual.val.textContent = formatEuros(base * 12);
        casillaRetencionAnual.val.textContent = formatEuros(retencion * 12);
      }

      campoBase.input.addEventListener("input", refrescar);
      campoBase.input.addEventListener("blur", async () => {
        try {
          await updateConfigFn({ alquiler_base_mensual: Number(campoBase.input.value) || 0 });
        } catch (err) {
          window.alert(err.message || "No se pudo guardar la base mensual del alquiler.");
        }
      });
      refrescar();

      container.appendChild(buildPaperForm([
        buildSeccionHead("RETENCIÓN DE ALQUILERES"),
        campoBase.row, casillaIva.row, casillaRetencion.row, casillaTotal.row,
        buildSeccionHead("TRIMESTRAL"),
        casillaBaseTrim.row, casillaRetencionTrim.row,
      ]));
      container.appendChild(bannerResultado);
      container.appendChild(buildPaperForm([
        buildSeccionHead("ANUAL — MODELO 180"),
        casillaBaseAnual.row, casillaRetencionAnual.row,
      ]));
    })
    .catch((err) => {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar el Modelo 115.";
      container.appendChild(p);
    });
}
