import { randomInviteCode, hashInviteCode } from "./adminTeacherHelpers.js";
import { getEnv } from "./env.js";
import { sendStudentInviteEmail } from "./email.js";

// Crea una invitación de alumno (código + upsert en student_invites) y envía
// el email de invitación — lógica compartida entre el alta individual
// (admin.students.routes.js, POST /admin/groups/:groupId/students) y la
// confirmación del import masivo (admin.students.import.routes.js), para no
// duplicar entre los dos la generación de código/URL ni el envío de email.
// `sendEmail` es inyectable (por defecto el remitente real) para poder
// testear sin mandar correos de verdad.
export async function createAndSendStudentInvite({
  admin,
  tenantId,
  tenantSlug,
  tenantName,
  groupId,
  groupName,
  email,
  firstName = "",
  lastName = "",
  createdBy,
  sendEmail = sendStudentInviteEmail,
}) {
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || null;
  const code = randomInviteCode();
  const codeHash = hashInviteCode(code);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 días
  const appBaseUrl = getEnv("APP_BASE_URL", "https://tutordigital.app").replace(/\/+$/, "");
  const inviteUrl = `${appBaseUrl}/invite.html?tenant=${encodeURIComponent(tenantSlug)}&token=${encodeURIComponent(code)}&email=${encodeURIComponent(email)}&group=${encodeURIComponent(groupId)}&role=student`;

  // Revoca cualquier invitación pending previa para el mismo email+grupo
  // antes de crear la nueva (mismo criterio que ya aplicaba el alta individual).
  await admin
    .from("student_invites")
    .update({ status: "revoked" })
    .eq("group_id", groupId)
    .eq("email", email)
    .eq("status", "pending");

  const { data: inviteRow, error: insertError } = await admin
    .from("student_invites")
    .insert({
      tenant_id: tenantId,
      group_id: groupId,
      email,
      first_name: firstName || null,
      last_name: lastName || null,
      display_name: displayName,
      created_by: createdBy,
      code_hash: codeHash,
      expires_at: expiresAt,
    })
    .select("id, email, status, created_at")
    .single();

  if (insertError) return { ok: false, error: insertError };

  let emailSent = false;
  try {
    await sendEmail({ to: email, tenantName, groupName, inviteUrl });
    emailSent = true;
  } catch {
    emailSent = false;
  }

  return {
    ok: true,
    invite: { id: inviteRow.id, email, invite_url: inviteUrl, status: "pending" },
    email_sent: emailSent,
  };
}
