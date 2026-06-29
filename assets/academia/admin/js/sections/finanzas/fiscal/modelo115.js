import { fetchModelo115 } from "../../../apiFinanzas.js";
import { updateConfig } from "../../../api.js";
import { buildField } from "../campoField.js";
import { buildCasillaRow, formatEuros } from "./casillaRow.js";
import { buildBannerInfo } from "./bannerInfo.js";
import { buildPanelBlock, buildTitulo } from "./panelBlock.js";

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

      const campoBase = buildField("Base mensual alquiler (€)", "input", {
        type: "number", min: "0", step: "0.01", value: baseMensualInicial,
      });
      const casillaIva = buildCasillaRow(null, `IVA ${IVA_PCT}%`);
      const casillaRetencion = buildCasillaRow(null, `Retención ${RETENCION_PCT}%`);
      const casillaTotal = buildCasillaRow(null, "Total a pagar propietario");
      const casillaBaseTrim = buildCasillaRow(null, "Base trimestral (× 3)");
      const casillaRetencionTrim = buildCasillaRow(null, "Retención trimestral (× 3)");
      const bannerResultado = buildBannerInfo("");
      const casillaBaseAnual = buildCasillaRow(null, "Base anual (× 12)");
      const casillaRetencionAnual = buildCasillaRow(null, "Total retenido anual");

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
        bannerResultado.textContent = `A ingresar · M115 T${trimestre} ${anio}: ${retencionTrim.toFixed(2)}€`;
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

      container.appendChild(buildPanelBlock([campoBase.wrap, casillaIva.row, casillaRetencion.row, casillaTotal.row]));
      container.appendChild(buildPanelBlock([buildTitulo("TRIMESTRAL"), casillaBaseTrim.row, casillaRetencionTrim.row]));
      container.appendChild(bannerResultado);
      container.appendChild(buildPanelBlock([buildTitulo("ANUAL — MODELO 180"), casillaBaseAnual.row, casillaRetencionAnual.row]));
    })
    .catch((err) => {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar el Modelo 115.";
      container.appendChild(p);
    });
}
