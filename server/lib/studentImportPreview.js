import { parseSpreadsheetBuffer, UnsupportedFileTypeError, CorruptFileError } from "./spreadsheetParser.js";
import { buildImportReview } from "./importReview.js";
import { deriveUnifiedStudentList } from "./studentLifecycle.js";
import { resolveStudentEmails } from "./resolveStudentEmails.js";
import { normalizeEmail } from "./adminStudentHelpers.js";

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 500;

const STATE_LABELS = {
  pendiente_aprobacion: "Pendiente de aprobación",
  invitado: "Invitado",
  activo: "Activo",
  archivado: "Archivado",
  rechazado: "Rechazado",
};

// Orquesta la previsualización del import masivo: parsea el archivo y lo
// valida contra quién YA existe en el centro (todos los grupos, no solo el
// de destino — reutiliza deriveUnifiedStudentList, la misma función pura de
// TAREA 1). GARANTÍA ESTRUCTURAL de que esta fase no persiste nada ni manda
// ningún email: recibe `admin` solo para hacer `.select()` (lecturas) — no
// se le pasa ningún remitente de email, y en ningún punto se llama a
// `.insert()/.upsert()/.update()/.delete()`. Ver
// tests/studentImportPreview.test.mjs, que lo comprueba pasando un `admin`
// donde esos métodos revientan si se llaman.
export async function buildStudentImportPreview({ admin, tenantId, buffer, filename, maxBytes = IMPORT_MAX_BYTES, maxRows = IMPORT_MAX_ROWS }) {
  if (buffer.length > maxBytes) {
    return { error: "file_too_large", maxBytes };
  }

  let table;
  try {
    table = await parseSpreadsheetBuffer({ buffer, filename });
  } catch (err) {
    if (err instanceof UnsupportedFileTypeError) return { error: "unsupported_file_type" };
    if (err instanceof CorruptFileError) return { error: "corrupt_file" };
    throw err;
  }

  const [invitesRes, studentsRes] = await Promise.all([
    admin.from("student_invites").select("id, email, status, group_id, created_at").eq("tenant_id", tenantId).limit(2000),
    admin.from("students").select("id, user_id, group_id, approval_status, created_at").eq("tenant_id", tenantId).limit(2000),
  ]);
  if (invitesRes.error || studentsRes.error) {
    return { error: "lookup_failed" };
  }

  const studentsWithEmail = await resolveStudentEmails(admin, studentsRes.data || []);
  const unified = deriveUnifiedStudentList({
    invites: invitesRes.data || [],
    students: studentsWithEmail,
    groupNamesById: new Map(),
  });

  const existingEmailStates = new Map();
  for (const row of unified) {
    if (row.email) existingEmailStates.set(normalizeEmail(row.email), STATE_LABELS[row.state] || row.state);
  }

  return buildImportReview(table, { existingEmailStates, maxRows });
}
