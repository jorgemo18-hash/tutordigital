import { fetchModelo130 } from "../../../apiFinanzas.js";
import { buildField } from "../campoField.js";
import { buildCasillaRow, formatEuros } from "./casillaRow.js";
import { buildBannerInfo } from "./bannerInfo.js";
import { buildPanelBlock } from "./panelBlock.js";

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

      const casilla01 = buildCasillaRow("01", "Ingresos computables del período");
      const casilla02 = buildCasillaRow("02", "Gastos fiscalmente deducibles");
      const casilla03 = buildCasillaRow("03", "Rendimiento neto");
      const casilla04 = buildCasillaRow("04", "20% de la casilla 03");
      const campoMinoracion = buildField("[06] Minoración", "input", { type: "number", min: "0", step: "0.01", value: "0" });
      const casilla07 = buildCasillaRow("07", "Resultado");
      const banner = buildBannerInfo("");

      function refrescar() {
        const rendimientoNeto = datos.ingresos - datos.gastos_deducibles;
        const veintePct = Math.max(0, rendimientoNeto * 0.2);
        const minoracion = Number(campoMinoracion.input.value) || 0;
        const resultado = veintePct - minoracion;

        casilla01.val.textContent = formatEuros(datos.ingresos);
        casilla02.val.textContent = formatEuros(datos.gastos_deducibles);
        casilla03.val.textContent = formatEuros(rendimientoNeto);
        casilla04.val.textContent = formatEuros(veintePct);
        casilla07.val.textContent = formatEuros(resultado);
        banner.textContent = `A ingresar · M130 T${trimestre} ${anio}: ${resultado.toFixed(2)}€`;
      }
      campoMinoracion.input.addEventListener("input", refrescar);
      refrescar();

      container.appendChild(
        buildPanelBlock([casilla01.row, casilla02.row, casilla03.row, casilla04.row, campoMinoracion.wrap, casilla07.row])
      );
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
