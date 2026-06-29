import { fetchModelo111 } from "../../../apiFinanzas.js";
import { updateConfig } from "../../../api.js";
import { buildField } from "../campoField.js";
import { buildCasillaRow, formatEuros } from "./casillaRow.js";
import { buildBannerInfo } from "./bannerInfo.js";
import { buildPanelBlock, buildTitulo } from "./panelBlock.js";

function claveNominas(trimestre, anio) {
  return `T${trimestre}_${anio}`;
}

function calcularRetencion(base, retencionPct) {
  return Math.round(base * (retencionPct / 100) * 100) / 100;
}

// Modelo 111 — retención de trabajadores. Base trimestral y % de
// retención son editables por trimestre (se guardan en
// academia_config.nominas_config bajo la clave "T{trimestre}_{anio}");
// la sección anual (Modelo 190) suma los 4 trimestres del año, sustituyendo
// el trimestre actual por lo que haya en los campos (sin esperar a guardar).
export function renderModelo111(container, { anio, trimestre, fetchModelo111Fn = fetchModelo111, updateConfigFn = updateConfig }) {
  container.innerHTML = "";
  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  container.appendChild(cargando);

  fetchModelo111Fn({ anio, trimestre })
    .then(({ trimestres, nominasConfig }) => {
      container.innerHTML = "";

      const actual = trimestres[trimestre - 1] || { base_trimestral: 0, retencion_pct: 15 };

      const campoBase = buildField("Base trimestral nóminas (€)", "input", {
        type: "number", min: "0", step: "0.01", value: actual.base_trimestral,
      });
      const campoRetencionPct = buildField("Retención (%)", "input", {
        type: "number", min: "0", max: "100", step: "0.5", value: actual.retencion_pct,
      });
      const casillaRetencion = buildCasillaRow(null, "Retención trimestral");
      const bannerResultado = buildBannerInfo("");
      const casillaBaseAnual = buildCasillaRow(null, "Base anual (suma 4 trimestres)");
      const casillaRetencionAnual = buildCasillaRow(null, "Total retenido anual — Modelo 190");

      function refrescar() {
        const base = Number(campoBase.input.value) || 0;
        const retencionPct = Number(campoRetencionPct.input.value) || 0;
        const retencion = calcularRetencion(base, retencionPct);
        casillaRetencion.val.textContent = formatEuros(retencion);
        bannerResultado.textContent = `A ingresar · M111 T${trimestre} ${anio}: ${retencion.toFixed(2)}€`;

        const baseAnual = trimestres.reduce((s, t, i) => s + (i === trimestre - 1 ? base : t.base_trimestral), 0);
        const retencionAnual = trimestres.reduce((s, t, i) => {
          const b = i === trimestre - 1 ? base : t.base_trimestral;
          const p = i === trimestre - 1 ? retencionPct : t.retencion_pct;
          return s + calcularRetencion(b, p);
        }, 0);
        casillaBaseAnual.val.textContent = formatEuros(baseAnual);
        casillaRetencionAnual.val.textContent = formatEuros(retencionAnual);
      }

      async function guardar() {
        const base = Number(campoBase.input.value) || 0;
        const retencionPct = Number(campoRetencionPct.input.value) || 0;
        const nuevoConfig = { ...nominasConfig, [claveNominas(trimestre, anio)]: { base, retencion_pct: retencionPct } };
        try {
          await updateConfigFn({ nominas_config: nuevoConfig });
        } catch (err) {
          window.alert(err.message || "No se pudo guardar la base de nóminas.");
        }
      }

      campoBase.input.addEventListener("input", refrescar);
      campoRetencionPct.input.addEventListener("input", refrescar);
      campoBase.input.addEventListener("blur", guardar);
      campoRetencionPct.input.addEventListener("blur", guardar);
      refrescar();

      container.appendChild(buildPanelBlock([campoBase.wrap, campoRetencionPct.wrap, casillaRetencion.row]));
      container.appendChild(bannerResultado);
      container.appendChild(buildPanelBlock([buildTitulo("ANUAL — MODELO 190"), casillaBaseAnual.row, casillaRetencionAnual.row]));
    })
    .catch((err) => {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar el Modelo 111.";
      container.appendChild(p);
    });
}
