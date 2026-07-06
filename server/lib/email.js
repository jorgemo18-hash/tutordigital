import { Resend } from "resend";
import { Sentry } from "./sentry.js";

const FROM = "TutorDigital <noreply@tutordigital.app>";
const BASE_URL = "https://tutordigital.app";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not configured");
  return new Resend(key);
}

// Antes se descartaba error.name/statusCode (ej. "invalid_from_address",
// "restricted_api_key") y solo sobrevivía error.message al primer catch —
// si el message venía vacío, el log resultante no daba ninguna pista real.
// `context` es lo mínimo que cada función de envío ya tiene a mano (to +
// qué operación es) — no se aporta tenant/alumno aquí porque este módulo
// no los conoce, son responsabilidad de quien llama más arriba.
function assertResendOk(error, context = {}) {
  if (!error) return;
  const err = new Error(error.message || "resend_send_failed");
  err.code = error.name;
  err.statusCode = error.statusCode;
  Sentry.captureException(err, { extra: { ...context, resendCode: error.name, resendStatus: error.statusCode } });
  throw err;
}

// ── Student invite ─────────────────────────────────────────────────────────

export async function sendStudentInviteEmail({ to, tenantName, groupName, inviteUrl }) {
  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f5f7;margin:0;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <p style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#ca7c3b;margin:0 0 20px">TutorDigital</p>
    <h1 style="font-size:22px;margin:0 0 12px;color:#111">Únete a tu clase</h1>
    <p style="font-size:15px;color:#444;line-height:1.5;margin:0 0 24px">
      El centro <strong>${escHtml(tenantName)}</strong> te ha invitado a unirte a TutorDigital
      en el grupo <strong>${escHtml(groupName)}</strong>.
    </p>
    <a href="${inviteUrl}"
       style="display:inline-block;background:#ca7c3b;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 24px;border-radius:10px">
      Activar mi acceso
    </a>
    <p style="font-size:13px;color:#666;margin:20px 0 0;line-height:1.5">
      Haz clic en el botón para crear tu cuenta y unirte a la clase.<br />
      El enlace es válido durante 30 días.<br /><br />
      Si el botón no funciona, copia este enlace en tu navegador:<br />
      <a href="${inviteUrl}" style="color:#ca7c3b;word-break:break-all">${inviteUrl}</a>
    </p>
  </div>
</body>
</html>`;

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Tu acceso a TutorDigital`,
    html,
  });

  assertResendOk(error, { operation: "sendStudentInviteEmail", to });
}

// ── Academia: invitación de acceso al alumno ────────────────────────────────

// `esNuevo` distingue la cuenta creada de cero (mensaje de bienvenida) de
// una ya existente reutilizada (provisionarAccesoAlumno en un tenant
// distinto, por ejemplo) — mismo generateLink({type:"recovery"}) en ambos
// casos, solo cambia el asunto y el encabezado.
export async function sendAcademiaAlumnoInviteEmail({ to, nombre, tenantName, setupLink, esNuevo = true }) {
  const subject = esNuevo
    ? "Tu acceso a TutorDigital"
    : `Ya tienes acceso al tutor de ${tenantName || "TutorDigital"}`;
  const intro = esNuevo
    ? `${tenantName ? `<strong>${escHtml(tenantName)}</strong> te ha dado de alta` : "Te han dado de alta"}
      en TutorDigital para que puedas acceder a tu tutor personal.`
    : `Ya tienes acceso a tu tutor personal${tenantName ? ` en <strong>${escHtml(tenantName)}</strong>` : ""} en TutorDigital.`;
  const cta = esNuevo
    ? "Haz clic en el botón para configurar tu contraseña y entrar por primera vez. El enlace es válido durante 24 horas."
    : "Haz clic en el botón para entrar. Si quieres cambiar tu contraseña, este mismo enlace te lo permite y es válido durante 24 horas.";

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f5f7;margin:0;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <p style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#ca7c3b;margin:0 0 20px">TutorDigital</p>
    <h1 style="font-size:22px;margin:0 0 12px;color:#111">¡Hola${nombre ? `, ${escHtml(nombre)}` : ""}!</h1>
    <p style="font-size:15px;color:#444;line-height:1.5;margin:0 0 24px">${intro}</p>
    <p style="font-size:15px;color:#444;line-height:1.5;margin:0 0 24px">${cta}</p>
    <a href="${setupLink}"
       style="display:inline-block;background:#ca7c3b;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 24px;border-radius:10px">
      ${esNuevo ? "Configurar mi contraseña" : "Entrar"}
    </a>
    <p style="font-size:13px;color:#666;margin:20px 0 0;line-height:1.5">
      Si el botón no funciona, copia este enlace en tu navegador:<br />
      <a href="${setupLink}" style="color:#ca7c3b;word-break:break-all">${escHtml(setupLink)}</a>
    </p>
  </div>
</body>
</html>`;

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
  });
  assertResendOk(error, { operation: "sendAcademiaAlumnoInviteEmail", to });
}

// ── Admin invite ───────────────────────────────────────────────────────────

export async function sendAdminInviteEmail({ to, tenantName, setupLink }) {
  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f5f7;margin:0;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <p style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#ca7c3b;margin:0 0 20px">TutorDigital</p>
    <h1 style="font-size:22px;margin:0 0 12px;color:#111">Bienvenido a TutorDigital</h1>
    <p style="font-size:15px;color:#444;line-height:1.5;margin:0 0 24px">
      Has sido registrado como <strong>administrador</strong> del centro
      <strong>${escHtml(tenantName)}</strong> en TutorDigital.
    </p>
    <p style="font-size:15px;color:#444;line-height:1.5;margin:0 0 24px">
      Haz clic en el botón para configurar tu contraseña y acceder al panel.
      El enlace es válido durante 24 horas.
    </p>
    <a href="${setupLink}"
       style="display:inline-block;background:#ca7c3b;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 24px;border-radius:10px">
      Configurar mi contraseña
    </a>
    <p style="font-size:13px;color:#666;margin:20px 0 0;line-height:1.5">
      Si el botón no funciona, copia este enlace en tu navegador:<br />
      <a href="${setupLink}" style="color:#ca7c3b;word-break:break-all">${escHtml(setupLink)}</a>
    </p>
    <p style="font-size:13px;color:#888;margin:16px 0 0;line-height:1.5">
      Si tienes algún problema escríbenos a
      <a href="mailto:info@tutordigital.app" style="color:#ca7c3b">info@tutordigital.app</a>.
    </p>
  </div>
</body>
</html>`;

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Configura tu acceso como administrador de ${tenantName} — TutorDigital`,
    html,
  });
  assertResendOk(error, { operation: "sendAdminInviteEmail", to, tenantName });
}

// ── School registration welcome ────────────────────────────────────────────

export async function sendSchoolRegistrationEmail({ to, directorName, schoolName, loginUrl }) {
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Tu academia "${schoolName}" está en revisión`,
    html: `
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f5f7;margin:0;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <p style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#ca7c3b;margin:0 0 20px">TutorDigital</p>
    <h1 style="font-size:22px;margin:0 0 12px;color:#111">¡Solicitud recibida, ${escHtml(directorName)}!</h1>
    <p style="font-size:15px;color:#444;line-height:1.5;margin:0 0 16px">
      Hemos recibido la solicitud de registro de <strong>${escHtml(schoolName)}</strong>.
    </p>
    <p style="font-size:15px;color:#444;line-height:1.5;margin:0 0 24px">
      Revisaremos tu solicitud en menos de 24 horas y te enviaremos otro email
      en cuanto esté activada. A partir de ese momento podrás acceder a la plataforma.
    </p>
    <a href="${loginUrl}" style="display:inline-block;background:#ca7c3b;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 24px;border-radius:10px">
      Acceder a TutorDigital
    </a>
    <p style="font-size:13px;color:#888;margin:20px 0 0">
      Si tienes alguna pregunta escríbenos a soporte@tutordigital.app
    </p>
  </div>
</body></html>`.trim(),
  });
  assertResendOk(error, { operation: "sendSchoolRegistrationEmail", to, schoolName });
}

// ── Support contact ────────────────────────────────────────────────────────

export async function sendSupportEmail({ fromEmail, subject, message }) {
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM,
    to: "soporte@tutordigital.app",
    reply_to: fromEmail,
    subject: `[Soporte] ${subject}`,
    html: `
<p><strong>De:</strong> ${escHtml(fromEmail)}</p>
<p><strong>Asunto:</strong> ${escHtml(subject)}</p>
<hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
<p style="white-space:pre-wrap;font-size:15px;color:#333">${escHtml(message)}</p>
    `.trim(),
  });
  assertResendOk(error, { operation: "sendSupportEmail", fromEmail });
}

// ── Academia: recibo a familia ─────────────────────────────────────────────

export async function sendReciboEmail({ to, subject, html }) {
  const resend = getResend();
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  assertResendOk(error, { operation: "sendReciboEmail", to, subject });
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
