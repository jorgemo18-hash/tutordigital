import { z } from "zod";
import { createAndSendStudentInvite } from "./studentInviteCreate.js";
import { normalizeEmail } from "./adminStudentHelpers.js";

const RowEmailSchema = z.string().email();

// Fase de confirmación del import masivo: crea una invitación (y manda su
// email) por cada fila seleccionada, reutilizando exactamente la misma
// lógica que el alta individual (createAndSendStudentInvite — ver
// admin.students.routes.js, POST /admin/groups/:groupId/students). Una fila
// que falle no aborta el resto: se cuenta como "skipped" y se sigue con las
// demás, para que un solo email problemático no tire todo el lote.
//
// El nombre parseado del archivo llega como una única cadena ("Ana García
// López") en vez de nombre/apellidos separados — partirlo a ciegas por el
// primer espacio produciría apellidos compuestos mal cortados, así que se
// guarda entero en `first_name` (lo único que de verdad se muestra en la UI
// es `display_name`, que queda correcto igualmente).
export async function confirmStudentImport({
  admin, tenantId, tenantSlug, tenantName, groupId, groupName, createdBy, rows, sendEmail,
}) {
  let invited = 0;
  let skipped = 0;

  for (const raw of rows || []) {
    const email = normalizeEmail(raw?.email);
    if (!email || !RowEmailSchema.safeParse(email).success) {
      skipped += 1;
      continue;
    }
    const name = String(raw?.name || "").trim();

    const result = await createAndSendStudentInvite({
      admin,
      tenantId,
      tenantSlug,
      tenantName,
      groupId,
      groupName,
      email,
      firstName: name,
      lastName: "",
      createdBy,
      ...(sendEmail ? { sendEmail } : {}),
    });

    if (result.ok) invited += 1;
    else skipped += 1;
  }

  return { invited, skipped, total_submitted: (rows || []).length };
}
