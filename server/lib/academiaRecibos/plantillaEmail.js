import { MESES } from "./calculos.js";

const METODOS_PAGO_LABEL = {
  bizum: "Bizum",
  domiciliado: "Domiciliado · IBAN",
  transferencia: "Transferencia",
  efectivo: "Efectivo",
};

const TEXTO_EXENCION_IVA_DEFAULT =
  "Servicio educativo exento de IVA según el artículo 20.Uno.9º de la Ley 37/1992 del IVA.";

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatEuros(n) {
  return Number(n || 0).toFixed(2);
}

function formatFecha(iso) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function capitaliza(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : str;
}

function buildLineasHtml(lineas) {
  return (lineas || [])
    .map((l) => {
      // Fallback genérico solo para recibos generados antes de guardar el
      // concepto (ver migración 062) — los nuevos siempre lo traen.
      const textoNota = l.descuento_recurrente_concepto || `Descuento recurrente -${l.descuento_recurrente_pct}%`;
      const nota =
        Number(l.descuento_recurrente_pct) > 0
          ? `<div style="font-size:10px;color:#c4834a;margin-top:2px">${escHtml(textoNota)}</div>`
          : "";
      return `
          <tr>
            <td style="padding:6px 0;border-bottom:1px solid #f2f2f2;color:#1a1a1a">${escHtml(l.nombre_alumno)}${nota}</td>
            <td style="padding:6px 0;border-bottom:1px solid #f2f2f2;color:#666">${escHtml(l.descripcion || "")}</td>
            <td style="padding:6px 0;border-bottom:1px solid #f2f2f2;color:#1a1a1a;text-align:right">${formatEuros(l.precio_bruto)} €</td>
          </tr>`;
    })
    .join("");
}

function buildDescuentosHtml(recibo, lineas) {
  if (!recibo.total_descuento || Number(recibo.total_descuento) <= 0) return "";
  const partes = [];
  if (Number(recibo.descuento_hermanos_pct) > 0) partes.push(`hermanos ${recibo.descuento_hermanos_pct}%`);
  if (Number(recibo.descuento_puntual_pct) > 0) partes.push(`puntual ${recibo.descuento_puntual_pct}%`);
  if ((lineas || []).some((l) => Number(l.descuento_recurrente_pct) > 0)) partes.push("recurrentes");
  const etiqueta = partes.length ? `Descuento (${partes.join(" + ")})` : "Descuento";
  return `
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#888;padding:4px 0">
        <div>Subtotal</div> <div>${formatEuros(recibo.total_bruto)} €</div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#c4834a;padding:4px 0 8px">
        <div>${escHtml(etiqueta)}</div><div>-${formatEuros(recibo.total_descuento)} €</div>
      </div>`;
}

// Línea de período (mes/año del recibo) + fecha de envío una vez enviado —
// separada del concepto editable para que el período nunca sea ambiguo
// aunque el admin reescriba el concepto.
function buildPeriodoHtml(recibo) {
  const periodo = `Recibo mes de ${capitaliza(MESES[recibo.mes] || "")} ${recibo.anio}`;
  const envio =
    recibo.estado === "enviado" && recibo.fecha_envio
      ? `<p style="font-size:12px;color:#888;margin:0 0 20px">Fecha de envío: ${formatFecha(recibo.fecha_envio)}</p>`
      : `<p style="font-size:12px;color:#888;margin:0 0 20px"></p>`;
  return `<p style="font-size:12px;color:#888;margin:0 0 4px">${escHtml(periodo)}</p>${envio}`;
}

// Recibo informativo enviado a la familia por email — inline CSS para
// máxima compatibilidad con clientes de correo. `config` es la fila de
// academia_config del tenant (datos del emisor + texto de exención de IVA).
export function buildReciboHtml({ recibo, familia, lineas, config, tenantNombre }) {
  const nombreAcademia = config?.nombre_emisor || tenantNombre || "";
  const mesAno = `${MESES[recibo.mes] || ""} ${recibo.anio}`;
  const metodoPago = METODOS_PAGO_LABEL[familia?.metodo_pago] || "—";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:20px;background:#f5f0e8;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden">
    <div style="background:#0a0806;padding:24px 28px">
      <div style="color:#c4834a;font-size:20px;font-weight:500">${escHtml(nombreAcademia)}</div>
      <div style="color:rgba(196,131,74,0.6);font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin-top:2px">Recibo informativo</div>
    </div>
    <div style="padding:24px 28px">
      <h1 style="font-size:18px;font-weight:500;margin:0 0 4px;color:#1a1a1a">${escHtml(recibo.concepto)}</h1>
      <p style="font-size:12px;color:#888;margin:0 0 4px;font-family:monospace">${escHtml(recibo.numero_recibo || "")} · emitido ${formatFecha(recibo.created_at)}</p>
      ${buildPeriodoHtml(recibo)}
      <table style="width:100%;margin-bottom:20px">
        <tr>
          <td style="width:50%;vertical-align:top">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin-bottom:4px">Familia</div>
            <div style="font-size:13px;color:#1a1a1a">${escHtml(familia?.nombre)}</div>
          </td>
          <td style="width:50%;vertical-align:top">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin-bottom:4px">Método de pago</div>
            <div style="font-size:13px;color:#1a1a1a">${escHtml(metodoPago)}</div>
          </td>
        </tr>
      </table>
      <hr style="border:none;border-top:1px solid #eee;margin:0 0 20px">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr>
            <th style="text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#888;padding-bottom:8px;font-weight:400">Alumno</th>
            <th style="text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#888;padding-bottom:8px;font-weight:400">Concepto</th>
            <th style="text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#888;padding-bottom:8px;font-weight:400">Importe</th>
          </tr>
        </thead>
        <tbody>
          ${buildLineasHtml(lineas)}
        </tbody>
      </table>
      ${buildDescuentosHtml(recibo, lineas)}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0 0;border-top:2px solid #eee;margin-top:8px">
        <div style="font-size:13px;color:#888">Total ${escHtml(mesAno)}</div>
        <div style="font-size:22px;font-weight:500;color:#c4834a">${formatEuros(recibo.total_neto)} €</div>
      </div>
      <p style="font-size:11px;color:#aaa;margin:16px 0 0;font-style:italic">${escHtml(config?.texto_exencion_iva || TEXTO_EXENCION_IVA_DEFAULT)}</p>
    </div>
    <div style="background:#f9f7f4;padding:14px 28px;font-size:11px;color:#aaa;border-top:1px solid #eee">
      Documento informativo sin validez fiscal.<br>
      ${escHtml(nombreAcademia)} · ${escHtml(config?.direccion_emisor || "")} · ${escHtml(config?.email_emisor || "")}
    </div>
  </div>
</body>
</html>`;
}
