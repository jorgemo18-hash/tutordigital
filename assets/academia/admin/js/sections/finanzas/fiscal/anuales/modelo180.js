import { fetchModeloAnual, guardarTrimestreFiscal } from "../../../../apiFinanzas.js";
import { buildCasillaEditable, buildCasillaSoloLectura, formatEuros } from "../casillaRow.js";
import { buildBannerResultado } from "../bannerResultado.js";
import { buildModeloCard, buildSeccionHead } from "../fiscalForm.js";
import { buildFilaDescargarPdf } from "../print/botonesImpresion.js";
import { imprimirModeloActual } from "../print/imprimirModeloActual.js";

const MODELO = "180";

// Lee la base trimestral y la retención de los datos guardados de M115.
// Si el trimestre no tiene datos, devuelve 0 con nota de ausencia.
function extraerDeM115(datosT) {
  if (!datosT) return { base: 0, retencion: 0, sinDatos: true };
  const ed = datosT.editable || {};
  const ov = datosT.overrides || {};
  const base = ed.base_mensual ?? 0;
  const retencionPct = ed.retencion_pct ?? 19;
  const baseTrim   = ov.base_trimestral   ?? (base * 3);
  const retenTrim  = ov.retencion_trimestral ?? (base * (retencionPct / 100) * 3);
  return { base: baseTrim, retencion: retenTrim, sinDatos: false };
}

function buildFilaSoloLectura(label, valorTexto, nota) {
  const { row, val } = buildCasillaSoloLectura(null, label);
  val.textContent = nota ? `${valorTexto} (${nota})` : valorTexto;
  return row;
}

// Modelo 180 — Resumen anual de retenciones de alquileres.
// Lee los 4 trimestres guardados de M115 y agrega base + retención anuales.
// Campos de datos del arrendador (NIF, nombre, dirección) son editables y
// se persisten en academia_fiscal_trimestres con trimestre=0.
export function renderModelo180(container, { anio, fetchModeloAnualFn = fetchModeloAnual, guardarTrimestreFiscalFn = guardarTrimestreFiscal }) {
  container.innerHTML = "";
  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando...";
  container.appendChild(cargando);

  fetchModeloAnualFn(MODELO, { anio })
    .then(({ datos, trimestres }) => {
      container.innerHTML = "";
      const ed = datos?.editable || {};

      // Campos del arrendador (guardados en editable del registro anual)
      const cNif  = buildCasillaEditable(null, "NIF arrendador",              { valorInicial: ed.nif_arrendador || "", attrs: { type: "text" } });
      const cNombre = buildCasillaEditable(null, "Nombre / Razón social",     { valorInicial: ed.nombre_arrendador || "", attrs: { type: "text" } });
      const cDir  = buildCasillaEditable(null, "Dirección del local",         { valorInicial: ed.direccion_local || "", attrs: { type: "text" } });

      // Extraer datos de los 4 trimestres de M115
      const [t1, t2, t3, t4] = trimestres.map(extraerDeM115);
      const baseAnual = t1.base + t2.base + t3.base + t4.base;
      const retenAnual = t1.retencion + t2.retencion + t3.retencion + t4.retencion;

      const { banner, val: bannerVal } = buildBannerResultado(`Total retenido anual · M180 ${anio}`, formatEuros(retenAnual));

      async function guardar() {
        try {
          await guardarTrimestreFiscalFn({
            modelo: MODELO, anio, trimestre: 0,
            datos: {
              editable: {
                nif_arrendador:    cNif.input.value.trim(),
                nombre_arrendador: cNombre.input.value.trim(),
                direccion_local:   cDir.input.value.trim(),
              },
              overrides: {},
            },
          });
        } catch (err) {
          window.alert(err.message || "No se pudo guardar el Modelo 180.");
        }
      }

      for (const { input } of [cNif, cNombre, cDir]) {
        input.addEventListener("blur", guardar);
      }

      function nota(t) { return t.sinDatos ? "sin datos" : null; }

      const formCard = buildModeloCard([
        buildSeccionHead("DATOS DEL ARRENDADOR"),
        cNif.row, cNombre.row, cDir.row,
        buildSeccionHead("RESUMEN ANUAL"),
        buildFilaSoloLectura("Base T1",         formatEuros(t1.base),      nota(t1)),
        buildFilaSoloLectura("Retenci\xf3n T1", formatEuros(t1.retencion), nota(t1)),
        buildFilaSoloLectura("Base T2",         formatEuros(t2.base),      nota(t2)),
        buildFilaSoloLectura("Retenci\xf3n T2", formatEuros(t2.retencion), nota(t2)),
        buildFilaSoloLectura("Base T3",         formatEuros(t3.base),      nota(t3)),
        buildFilaSoloLectura("Retenci\xf3n T3", formatEuros(t3.retencion), nota(t3)),
        buildFilaSoloLectura("Base T4",         formatEuros(t4.base),      nota(t4)),
        buildFilaSoloLectura("Retenci\xf3n T4", formatEuros(t4.retencion), nota(t4)),
        buildFilaSoloLectura("Base anual total",       formatEuros(baseAnual),  null),
        buildFilaSoloLectura("Retenci\xf3n anual total", formatEuros(retenAnual), null),
      ]);

      async function imprimir() {
        await imprimirModeloActual({ container, formCard, banner, titulo: `Modelo 180 — ${anio}`, anexoHtml: "" });
      }
      container.append(formCard, banner, buildFilaDescargarPdf(imprimir));
    })
    .catch((err) => {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar el Modelo 180.";
      container.appendChild(p);
    });
}
