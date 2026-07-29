import { escHtml } from "../../../assets/shared/js/escHtml.js";

function formatFechaLarga(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatHoraCorta(hora) {
  return String(hora || "").slice(0, 5);
}

// Mismo tratamiento que buildMarcaHtml en academiaRecibos/plantillaEmail.js
// (logo si hay, si no el nombre en texto) — no se importa de ahí para no
// acoplar este email, mucho más simple, al módulo de recibos.
function buildMarcaHtml(nombreAcademia, logoUrl) {
  if (logoUrl) {
    return `<img src="${escHtml(logoUrl)}" alt="${escHtml(nombreAcademia || "Logo")}" style="max-height:32px;max-width:180px;display:block">`;
  }
  return `<div style="color:#c4834a;font-size:20px;font-weight:500">${escHtml(nombreAcademia)}</div>`;
}

// Aviso de ausencia enviado a la familia — misma tarjeta de cabecera oscura
// que el recibo (nombre/logo del centro), pero sin tabla: es un único
// párrafo informativo. `config` es la fila de academia_config del tenant.
export function buildAusenciaEmailHtml({ alumnoNombre, familiaNombre, fecha, hora, motivo, config, tenantNombre }) {
  const nombreAcademia = config?.nombre_emisor || tenantNombre || "";
  const motivoHtml = motivo
    ? `<p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 20px">Motivo indicado: ${escHtml(motivo)}</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:20px;background:#f5f0e8;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden">
    <div style="background:#0a0806;padding:24px 28px">
      ${buildMarcaHtml(nombreAcademia, config?.logo_url)}
      <div style="color:rgba(196,131,74,0.6);font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin-top:2px">Aviso de ausencia</div>
    </div>
    <div style="padding:24px 28px">
      <p style="font-size:15px;color:#1a1a1a;line-height:1.6;margin:0 0 16px">Estimada familia ${escHtml(familiaNombre)},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;margin:0 0 16px">
        Le informamos de que <strong>${escHtml(alumnoNombre)}</strong> no ha asistido a su clase del
        ${formatFechaLarga(fecha)} a las ${formatHoraCorta(hora)}.
      </p>
      ${motivoHtml}
      <p style="font-size:14px;color:#444;line-height:1.6;margin:24px 0 0">
        Atentamente,<br>${escHtml(nombreAcademia)}
      </p>
    </div>
  </div>
</body>
</html>`;
}
