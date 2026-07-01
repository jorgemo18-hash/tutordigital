import { fetchModeloAnual, guardarTrimestreFiscal } from "../../../../apiFinanzas.js";
import { buildCasillaCalculada, buildCasillaSoloLectura, formatEuros } from "../casillaRow.js";
import { buildBannerResultado } from "../bannerResultado.js";
import { buildModeloCard, buildSeccionHead } from "../fiscalForm.js";
import { buildFilaDescargarPdf } from "../print/botonesImpresion.js";
import { imprimirModeloActual } from "../print/imprimirModeloActual.js";

const MODELO = "390";

// Extrae cuota devengada [46] y deducible [47] de datos de M303.
function extraerDeM303(datosT) {
  if (!datosT) return { devengada: 0, deducible: 0, sinDatos: true };
  const ov = datosT.overrides || {};
  const ed = datosT.editable  || {};
  // Si hay override de total_devengado lo usamos, si no recalculamos
  const b01 = ed.base_general       ?? 0;
  const b03 = ed.base_reducido      ?? 0;
  const b05 = ed.base_superreducido ?? 0;
  const devengada = ov.total_devengado ?? (
    (ov.cuota_general       ?? b01 * 0.21) +
    (ov.cuota_reducido      ?? b03 * 0.10) +
    (ov.cuota_superreducido ?? b05 * 0.04)
  );
  const deducible = ov.total_deducible ?? (ov.iva_deducible ?? (datosT.calculado?.iva_deducible ?? 0));
  return { devengada, deducible, sinDatos: false };
}

function buildFilaSoloLectura(label, valorTexto, nota) {
  const { row, val } = buildCasillaSoloLectura(null, label);
  val.textContent = nota ? `${valorTexto} (${nota})` : valorTexto;
  return row;
}

// Modelo 390 — Resumen anual IVA (solo sociedad con desglose_iva activo).
// Agrega los cuatro trimestres de M303 y persiste overrides propios en
// academia_fiscal_trimestres con trimestre=0.
export function renderModelo390(container, { anio, fetchModeloAnualFn = fetchModeloAnual, guardarTrimestreFiscalFn = guardarTrimestreFiscal }) {
  container.innerHTML = "";
  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando...";
  container.appendChild(cargando);

  fetchModeloAnualFn(MODELO, { anio })
    .then(({ datos, trimestres }) => {
      container.innerHTML = "";
      const ov = datos?.overrides || {};

      const [t1, t2, t3, t4] = trimestres.map(extraerDeM303);
      const devengadaTotal = t1.devengada + t2.devengada + t3.devengada + t4.devengada;
      const deducibleTotal = t1.deducible + t2.deducible + t3.deducible + t4.deducible;
      const resultadoAuto  = devengadaTotal - deducibleTotal;

      const cDevengada = buildCasillaCalculada(null, "Cuota devengada anual total",  { valorInicialOverride: ov.devengada_total ?? null });
      const cDeducible = buildCasillaCalculada(null, "Cuota deducible anual total",  { valorInicialOverride: ov.deducible_total ?? null });
      const cResultado = buildCasillaCalculada(null, "Resultado anual",              { valorInicialOverride: ov.resultado ?? null });

      const { banner, val: bannerVal } = buildBannerResultado(`Resultado anual · M390 ${anio}`, "");

      function refrescar() {
        cDevengada.setComputed(devengadaTotal);
        cDeducible.setComputed(deducibleTotal);
        cResultado.setComputed(cDevengada.getValue() - cDeducible.getValue());
        bannerVal.textContent = formatEuros(cResultado.getValue());
      }

      async function guardar() {
        const overrides = {};
        if (cDevengada.isOverridden()) overrides.devengada_total = cDevengada.getValue();
        if (cDeducible.isOverridden()) overrides.deducible_total = cDeducible.getValue();
        if (cResultado.isOverridden()) overrides.resultado = cResultado.getValue();
        try {
          await guardarTrimestreFiscalFn({ modelo: MODELO, anio, trimestre: 0, datos: { editable: {}, overrides } });
        } catch (err) {
          window.alert(err.message || "No se pudo guardar el Modelo 390.");
        }
      }

      for (const c of [cDevengada, cDeducible, cResultado]) {
        c.input.addEventListener("input", refrescar);
        c.input.addEventListener("blur", guardar);
      }
      refrescar();

      function nota(t) { return t.sinDatos ? "sin datos" : null; }

      const formCard = buildModeloCard([
        buildSeccionHead("RESUMEN ANUAL IVA"),
        buildFilaSoloLectura("Cuota devengada T1",  formatEuros(t1.devengada), nota(t1)),
        buildFilaSoloLectura("Cuota deducible T1",  formatEuros(t1.deducible), nota(t1)),
        buildFilaSoloLectura("Cuota devengada T2",  formatEuros(t2.devengada), nota(t2)),
        buildFilaSoloLectura("Cuota deducible T2",  formatEuros(t2.deducible), nota(t2)),
        buildFilaSoloLectura("Cuota devengada T3",  formatEuros(t3.devengada), nota(t3)),
        buildFilaSoloLectura("Cuota deducible T3",  formatEuros(t3.deducible), nota(t3)),
        buildFilaSoloLectura("Cuota devengada T4",  formatEuros(t4.devengada), nota(t4)),
        buildFilaSoloLectura("Cuota deducible T4",  formatEuros(t4.deducible), nota(t4)),
        buildSeccionHead("RESULTADO"),
        cDevengada.row, cDeducible.row, cResultado.row,
      ]);

      async function imprimir() {
        await imprimirModeloActual({ container, formCard, banner, titulo: `Modelo 390 — ${anio}`, anexoHtml: "" });
      }
      container.append(formCard, banner, buildFilaDescargarPdf(imprimir));
    })
    .catch((err) => {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar el Modelo 390.";
      container.appendChild(p);
    });
}
