import { Resend } from "resend";

const FROM = "TutorDigital <noreply@tutordigital.app>";
const BASE_URL = "https://tutordigital.app";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not configured");
  return new Resend(key);
}

// ── Student invite ─────────────────────────────────────────────────────────

export async function sendStudentInviteEmail({ to, tenantName, groupName, joinCodeHint }) {
  const registerUrl = `${BASE_URL}/student-register.html?code=${encodeURIComponent(joinCodeHint)}`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f5f7;margin:0;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <p style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#ca7c3b;margin:0 0 20px">TutorDigital</p>
    <h1 style="font-size:22px;margin:0 0 12px;color:#111">Tienes acceso a tu clase</h1>
    <p style="font-size:15px;color:#444;line-height:1.5;margin:0 0 24px">
      El centro <strong>${escHtml(tenantName)}</strong> te ha dado acceso a TutorDigital
      para el grupo <strong>${escHtml(groupName)}</strong>.
    </p>
    <a href="${registerUrl}"
       style="display:inline-block;background:#ca7c3b;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 24px;border-radius:10px">
      Crear mi cuenta
    </a>
    <p style="font-size:13px;color:#666;margin:20px 0 0;line-height:1.5">
      Haz clic en el botón, introduce tu email y elige una contraseña para entrar.<br />
      Si el botón no funciona, copia este enlace en tu navegador:<br />
      <a href="${registerUrl}" style="color:#ca7c3b;word-break:break-all">${registerUrl}</a>
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

  if (error) throw new Error(error.message || "resend_send_failed");
}

// ── Admin invite ───────────────────────────────────────────────────────────

export async function sendAdminInviteEmail({ to, tenantName, tempPassword }) {
  const loginUrl = `${BASE_URL}/admin`;
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
    <div style="background:#f8f5f0;border-radius:10px;padding:20px;margin:0 0 24px">
      <p style="margin:0 0 8px;font-size:13px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Tus credenciales de acceso</p>
      <p style="margin:0 0 6px;font-size:14px;color:#111"><strong>Email:</strong> ${escHtml(to)}</p>
      <p style="margin:0;font-size:14px;color:#111"><strong>Contraseña temporal:</strong>
        <code style="background:#eee;padding:2px 6px;border-radius:4px;font-size:14px">${escHtml(tempPassword)}</code>
      </p>
    </div>
    <a href="${loginUrl}"
       style="display:inline-block;background:#ca7c3b;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 24px;border-radius:10px">
      Acceder al panel
    </a>
    <p style="font-size:13px;color:#888;margin:20px 0 0;line-height:1.5">
      Por seguridad, cámbiala en tu primer acceso.<br/>
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
    subject: `Tu acceso como administrador de ${tenantName} — TutorDigital`,
    html,
  });
  if (error) throw new Error(error.message || "resend_send_failed");
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
