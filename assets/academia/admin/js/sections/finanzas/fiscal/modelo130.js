import { fetchModelo130 } from "../../../apiFinanzas.js";
import { buildCasillaFiscal, buildCasillaEditable, formatEuros } from "./casillaRow.js";
import { buildBannerResultado } from "./bannerResultado.js";
import { buildPaperForm, buildSeccionHead } from "./fiscalForm.js";

// Modelo 130 — IRPF estimación directa, pago fraccionado trimestral.
// Casillas [01]/[02] vienen del backend (ingresos/gastos reales del
// trimestre, ver fiscalConsultas.js); [03]/[04]/[07] se calculan aquí.
// [06] (minoración) es un campo manual que no se persiste en ningún
// lado — siempre arranca en 0 al cambiar de período.
export function renderModelo130(container, { anio, trimestre, fetchModelo130Fn = fetchModelo130 }) {
  container.innerHTML = "";
  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  container.appendChild(cargando);

  fetchModelo130Fn({ anio, trimestre })
    .then((datos) => {
      container.innerHTML = "";

      const casilla01 = buildCasillaFiscal("01", "Ingresos computables del período");
      const casilla02 = buildCasillaFiscal("02", "Gastos fiscalmente deducibles");
      const casilla03 = buildCasillaFiscal("03", "Rendimiento neto", { calculada: true });
      const casilla04 = buildCasillaFiscal("04", "20% de la casilla 03", { calculada: true });
      const casilla06 = buildCasillaEditable("06", "Minoración", { valorInicial: 0, attrs: { min: "0", step: "0.01" } });
      const casilla07 = buildCasillaFiscal("07", "Resultado", { calculada: true });
      const { banner, val: bannerVal } = buildBannerResultado(`A ingresar · M130 T${trimestre} ${anio}`, "");

      function refrescar() {
        const rendimientoNeto = datos.ingresos - datos.gastos_deducibles;
        const veintePct = Math.max(0, rendimientoNeto * 0.2);
        const minoracion = Number(casilla06.input.value) || 0;
        const resultado = veintePct - minoracion;

        casilla01.val.textContent = formatEuros(datos.ingresos);
        casilla02.val.textContent = formatEuros(datos.gastos_deducibles);
        casilla03.val.textContent = formatEuros(rendimientoNeto);
        casilla04.val.textContent = formatEuros(veintePct);
        casilla07.val.textContent = formatEuros(resultado);
        bannerVal.textContent = formatEuros(resultado);
      }
      casilla06.input.addEventListener("input", refrescar);
      refrescar();

      container.appendChild(buildPaperForm([
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
