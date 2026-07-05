import { apiFetch } from "../../../shared/js/auth.js";
import { getFileKind } from "../../lib/files.js";
import { createTicket } from "../../lib/tickets.js";

function collectLastMessages(getHistory, limit = 12) {
  try {
    const hist = getHistory();
    if (!Array.isArray(hist)) return [];
    return hist.slice(-limit).map((m) => ({
      role: m?.role === "assistant" ? "assistant" : "user",
      content: String(m?.content || ""),
    }));
  } catch {
    return [];
  }
}

function getAttachmentSnapshot(getPendingImage) {
  try {
    const pending = getPendingImage();
    const file = pending?.file || null;
    if (!file) return null;
    const info = getFileKind(file);
    return {
      kind: info.kind,
      name: info.name || "",
      mime: info.type || info.suggestedMime || "",
    };
  } catch {
    return null;
  }
}

export function initTeacherTicketCTAFeature({
  addTeacherCTA,
  getHistory,
  getPendingImage,
  getCurrentMode,
  debug = false,
}) {
  function createTeacherTicket(type) {
    return createTicket({
      type,
      mode: getCurrentMode(),
      lastMessages: collectLastMessages(getHistory, 12),
      attachment: getAttachmentSnapshot(getPendingImage),
    });
  }

  function pushTeacherCTA(type) {
    return addTeacherCTA?.(type, {
      onClick: async ({ btn }) => {
        const ticket = createTeacherTicket(type);
        if (!ticket) return;

        const messages = (ticket.lastMessages || [])
          .map((m) => `${m.role === "assistant" ? "Asistente" : "Alumno"}: ${m.content}`)
          .join("\n");

        const attachment = ticket.attachment
          ? `\nAdjunto: ${ticket.attachment.name || "archivo"} (${ticket.attachment.mime || "desconocido"})`
          : "";

        const detailParts = [
          `Tipo: ${ticket.type || "help"}`,
          ticket.mode ? `Modo: ${ticket.mode}` : "",
          messages ? `Mensajes:\n${messages}` : "",
        ].filter(Boolean);

        const payload = {
          title: "Necesita profesor",
          detail: `${detailParts.join("\n\n")}${attachment}`.trim(),
        };

        try {
          const res = await apiFetch("/api/v1/tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (btn) {
            btn.textContent = res.ok ? "Enviado ✓" : "Error al enviar";
          }
        } catch {
          if (btn) btn.textContent = "Error al enviar";
        }
      },
    });
  }

  return { pushTeacherCTA };
}
