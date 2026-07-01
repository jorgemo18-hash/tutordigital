import { fetchModeloFiscal, guardarTrimestreFiscal } from "../../../apiFinanzas.js";
import { buildCasillaEditable, buildCasillaCalculada, formatEuros } from "./casillaRow.js";
import { buildBannerResultado } from "./bannerResultado.js";
import { buildModeloCard, buildSeccionHead } from "./fiscalForm.js";
import { buildFilaDescargarPdf } from "./print/botonesImpresion.js";
import { imprimirModeloActual } from "./print/imprimirModeloActual.js";

const MODELO = "303";

// Modelo 303 — IVA trimestral (solo sociedad). Solo disponible si
// desglose_iva = true en academia_config (el admin lo activa en Ajustes >
// Facturación). Si está desactivado, muestra un aviso en su lugar.
export function renderModelo303(container, { anio, trimestre, desglose_iva, fetchModeloFiscalFn = fetchModeloFiscal, guardarTrimestreFiscalFn = guardarTrimestreFiscal }) {
  container.innerHTML = "";

  if (!desglose_iva) {
    const aviso = document.createElement("div");
    aviso.className = "ac-fiscal-sin-regimen";
    const p = document.createElement("p");
    p.textContent = "El desglose de IVA no está activado. Actívalo en Ajustes › Facturación para usar este modelo.";
    aviso.appendChild(p);
    container.appendChild(aviso);
    return;
  }

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando...";
  container.appendChild(cargando);

  fetchModeloFiscalFn(MODELO, { anio, trimestre })
    .then((datos) => {
      container.innerHTML = "";
      const overrides = datos?.overrides || {};
      const editable  = datos?.editable  || {};
      const calculado = datos?.calculado  || {};

      // Sección OPERACIONES CORRIENTES
      const c01 = buildCasillaEditable("01", "Base imponible tipo general (21%)", { valorInicial: editable.base_general ?? 0, attrs: { min: "0", step: "0.01" } });
      const c02 = buildCasillaCalculada("02", "Cuota devengada tipo general",    { valorInicialOverride: overrides.cuota_general ?? null });
      const c03 = buildCasillaEditable("03", "Base imponible tipo reducido (10%)",  { valorInicial: editable.base_reducido ?? 0, attrs: { min: "0", step: "0.01" } });
      const c04 = buildCasillaCalculada("04", "Cuota devengada tipo reducido",   { valorInicialOverride: overrides.cuota_reducido ?? null });
      const c05 = buildCasillaEditable("05", "Base imponible tipo superreducido (4%)", { valorInicial: editable.base_superreducido ?? 0, attrs: { min: "0", step: "0.01" } });
      const c06 = buildCasillaCalculada("06", "Cuota devengada superreducido",   { valorInicialOverride: overrides.cuota_superreducido ?? null });
      // Sección IVA DEDUCIBLE
      const c20 = buildCasillaCalculada("20", "Cuotas soportadas deducibles",   { valorInicialOverride: overrides.iva_deducible ?? (calculado.iva_deducible ?? null) });
      // Sección RESULTADO
      const c46 = buildCasillaCalculada("46", "Total cuota devengada",           { valorInicialOverride: overrides.total_devengado ?? null });
      const c47 = buildCasillaCalculada("47", "Total cuota deducible",           { valorInicialOverride: overrides.total_deducible ?? null });
      const c48 = buildCasillaCalculada("48", "Resultado",                       { valorInicialOverride: overrides.resultado ?? null });

      const { banner, val: bannerVal } = buildBannerResultado(`A ingresar · M303 T${trimestre} ${anio}`, "");

      function refrescar() {
        const b01 = Number(c01.input.value) || 0;
        const b03 = Number(c03.input.value) || 0;
        const b05 = Number(c05.input.value) || 0;
        c02.setComputed(b01 * 0.21);
        c04.setComputed(b03 * 0.10);
        c06.setComputed(b05 * 0.04);
        const devengado = c02.getValue() + c04.getValue() + c06.getValue();
        c46.setComputed(devengado);
        c47.setComputed(c20.getValue());
        c48.setComputed(devengado - c20.getValue());
        bannerVal.textContent = formatEuros(c48.getValue());
      }

      async function guardar() {
        const datosGuardar = {
          editable: {
            base_general:       Number(c01.input.value) || 0,
            base_reducido:      Number(c03.input.value) || 0,
            base_superreducido: Number(c05.input.value) || 0,
          },
          overrides: {},
          calculado: { iva_deducible: calculado.iva_deducible ?? 0 },
        };
        if (c02.isOverridden()) datosGuardar.overrides.cuota_general      = c02.getValue();
        if (c04.isOverridden()) datosGuardar.overrides.cuota_reducido     = c04.getValue();
        if (c06.isOverridden()) datosGuardar.overrides.cuota_superreducido = c06.getValue();
        if (c20.isOverridden()) datosGuardar.overrides.iva_deducible      = c20.getValue();
        if (c46.isOverridden()) datosGuardar.overrides.total_devengado    = c46.getValue();
        if (c47.isOverridden()) datosGuardar.overrides.total_deducible    = c47.getValue();
        if (c48.isOverridden()) datosGuardar.overrides.resultado          = c48.getValue();
        try {
          await guardarTrimestreFiscalFn({ modelo: MODELO, anio, trimestre, datos: datosGuardar });
        } catch (err) {
          window.alert(err.message || "No se pudo guardar el Modelo 303.");
        }
      }

      const todosLosInputs = [c01.input, c02.input, c03.input, c04.input, c05.input, c06.input, c20.input, c46.input, c47.input, c48.input];
      for (const input of todosLosInputs) {
        input.addEventListener("input", refrescar);
        input.addEventListener("blur", guardar);
      }
      refrescar();

      const formCard = buildModeloCard([
        buildSeccionHead("OPERACIONES CORRIENTES"),
        c01.row, c02.row, c03.row, c04.row, c05.row, c06.row,
        buildSeccionHead("IVA DEDUCIBLE"),
        c20.row,
        buildSeccionHead("RESULTADO"),
        c46.row, c47.row, c48.row,
      ]);

      async function imprimir() {
        await imprimirModeloActual({ container, formCard, banner, titulo: `Modelo 303 — T${trimestre} ${anio}`, anexoHtml: "" });
      }
      container.append(formCard, banner, buildFilaDescargarPdf(imprimir));
    })
    .catch((err) => {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar el Modelo 303.";
      container.appendChild(p);
    });
}
