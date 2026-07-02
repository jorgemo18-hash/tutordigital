import { buildAusenciaEmailHtml } from "./ausenciaEmailTemplate.js";
import { sendReciboEmail } from "../email.js";

// Envía el aviso de ausencia a la familia del alumno y marca la sesión
// (buscada por alumno_id+fecha, ya guardada por POST /academia/sesiones
// antes de llegar aquí) como notificada. Reusa sendReciboEmail — genérico
// (to/subject/html), no hace falta una función de envío propia del diario.
// Mismo patrón de retorno que enviarReciboPorId: { ok:true } o
// { ok:false, code, motivo }.
export async function enviarAusenciaEmail(admin, { tenantId, tenantNombre, alumnoId, fecha, hora, motivo }) {
  const [{ data: alumno, error: alumnoErr }, { data: sesion, error: sesionErr }] = await Promise.all([
    admin.from("academia_alumnos").select("nombre, familia_id").eq("id", alumnoId).eq("tenant_id", tenantId).maybeSingle(),
    admin.from("academia_sesiones").select("id").eq("alumno_id", alumnoId).eq("fecha", fecha).eq("tenant_id", tenantId).maybeSingle(),
  ]);
  if (alumnoErr || sesionErr) return { ok: false, code: "fetch_failed", motivo: "No se pudo leer el alumno o la sesión." };
  if (!alumno) return { ok: false, code: "not_found", motivo: "Alumno no encontrado." };
  if (!sesion) return { ok: false, code: "not_found", motivo: "No hay una ausencia guardada para ese alumno en esa fecha." };

  let familia = null;
  if (alumno.familia_id) {
    const { data, error } = await admin
      .from("academia_familias")
      .select("nombre, email")
      .eq("id", alumno.familia_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) return { ok: false, code: "fetch_failed", motivo: "No se pudo leer la familia." };
    familia = data;
  }
  if (!familia?.email) {
    return { ok: false, code: "no_email", motivo: "La familia no tiene email registrado." };
  }

  const { data: config } = await admin
    .from("academia_config")
    .select("nombre_emisor, logo_url")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const html = buildAusenciaEmailHtml({
    alumnoNombre: alumno.nombre,
    familiaNombre: familia.nombre,
    fecha,
    hora,
    motivo,
    config,
    tenantNombre,
  });

  try {
    await sendReciboEmail({ to: familia.email, subject: `Ausencia de ${alumno.nombre} — ${fecha}`, html });
  } catch (err) {
    return { ok: false, code: "send_failed", motivo: err.message || "Fallo al enviar el email." };
  }

  const { error: updateErr } = await admin
    .from("academia_sesiones")
    .update({ email_familia_enviado: true, email_familia_enviado_at: new Date().toISOString() })
    .eq("id", sesion.id)
    .eq("tenant_id", tenantId);
  if (updateErr) {
    return { ok: false, code: "update_failed", motivo: "El email se envió pero no se pudo marcar la sesión." };
  }

  return { ok: true };
}
