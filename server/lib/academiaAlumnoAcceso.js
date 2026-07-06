import { randomBytes } from "crypto";
import { sendAcademiaAlumnoInviteEmail } from "./email.js";

const CHANGE_PASSWORD_URL = "https://tutordigital.app/change-password.html";

function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(12)).map((b) => chars[b % chars.length]).join("");
}

function esUsuarioYaExistente(err) {
  return (
    err?.code === "email_exists" ||
    err?.code === "user_already_exists" ||
    err?.status === 422 ||
    String(err?.message || "").toLowerCase().includes("already registered")
  );
}

async function buscarUsuarioPorEmail(admin, email) {
  const { data, error } = await admin.rpc("admin_find_user_by_email", { p_email: email });
  if (error) return { ok: false, error };
  return { ok: true, userId: data?.[0]?.user_id || null };
}

// Reutiliza la cuenta si el email ya existe en auth.users (createUser falla
// con email_exists) en vez de duplicarla — mismo criterio defensivo que
// student.register.routes.js.
async function resolverOCrearUsuario(admin, email) {
  const found = await buscarUsuarioPorEmail(admin, email);
  if (!found.ok) return found;
  if (found.userId) return { ok: true, userId: found.userId, esNuevo: false };

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: generateTempPassword(),
    email_confirm: true,
  });
  if (!createErr) return { ok: true, userId: created.user.id, esNuevo: true };
  if (!esUsuarioYaExistente(createErr)) return { ok: false, error: createErr };

  // Carrera: alguien lo creó entre el lookup y el createUser de arriba.
  const retry = await buscarUsuarioPorEmail(admin, email);
  if (!retry.ok || !retry.userId) return { ok: false, error: retry.error || createErr };
  return { ok: true, userId: retry.userId, esNuevo: false };
}

// Da de alta (o vincula) el acceso real de un alumno de academia al tutor:
// cuenta en auth.users, membership activa, fila en students (approval_status
// approved — students.approval_status='approved' es lo que resolveTenantForUser
// exige para cualquier acceso de rol student), y el email de invitación con
// enlace para fijar contraseña, solo si la cuenta es nueva (una ya existente
// conserva su contraseña actual). Devuelve { ok:true, provisioned:false } sin
// tocar nada si el alumno no tiene email.
export async function provisionarAccesoAlumno(admin, { tenantId, tenantName, email, nombre }) {
  if (!email) return { ok: true, provisioned: false };

  const userRes = await resolverOCrearUsuario(admin, email);
  if (!userRes.ok) return { ok: false, error: userRes.error };
  const { userId, esNuevo } = userRes;

  const { error: memberErr } = await admin
    .from("tenant_memberships")
    .upsert({ tenant_id: tenantId, user_id: userId, role: "student", status: "active" }, { onConflict: "tenant_id,user_id" });
  if (memberErr) return { ok: false, error: memberErr };

  const { data: studentRow, error: studentErr } = await admin
    .from("students")
    .upsert(
      { tenant_id: tenantId, user_id: userId, display_name: nombre, approval_status: "approved" },
      { onConflict: "tenant_id,user_id" }
    )
    .select("id")
    .single();
  if (studentErr) return { ok: false, error: studentErr };

  if (esNuevo) {
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: CHANGE_PASSWORD_URL },
    });
    if (!linkErr && linkData?.properties?.action_link) {
      await sendAcademiaAlumnoInviteEmail({ to: email, nombre, tenantName, setupLink: linkData.properties.action_link })
        .catch((err) => console.error("[academia] alumno invite email failed:", err.message));
    }
  }

  return { ok: true, provisioned: true, userId, studentId: studentRow.id };
}
