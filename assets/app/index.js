<file name=assets/app/app.css>
/* Nombre del adjunto por tipo (preview + chat) */
.attachPreview .attachName,
.bubble .attachName {
  font-weight: 800;
}

/* Preview (fondo blanco) */
.attachPreview .attachName { color: #333; }
.attachPreview .attachName.pdf { color: #d32f2f; }   /* rojo PDF */
.attachPreview .attachName.doc,
.attachPreview .attachName.docx { color: #1976d2; }  /* azul Word */

/* Chat bubbles (fondo claro) */
.bubble .attachName { color: #333; }
.bubble .attachName.pdf { color: #d32f2f; }
.bubble .attachName.doc,
.bubble .attachName.docx { color: #1976d2; }

/* Chat bubble del usuario (fondo negro): colores más claros para contraste */
.row.u .bubble .attachName.pdf { color: #ff6b6b; }
.row.u .bubble .attachName.doc,
.row.u .bubble .attachName.docx { color: #64b5f6; }
</file>

<file name=assets/app/render/chatRenderer.js>
import { getHistory, setHistory } from "../state/storage.js";
import { asciiToLatex, looksMath } from "../controllers/math.js";

// Helper to get file extension class for styling
function ttdFileExtClass(name) {
  const n = String(name || "").toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".docx")) return "docx";
  if (n.endsWith(".doc")) return "doc";
  return "";
}

function buildAttachmentLabel(filename, prefixText) {
  const wrap = document.createElement("span");
  if (prefixText) {
    const pre = document.createElement("span");
    pre.textContent = String(prefixText);
    wrap.appendChild(pre);
  }

  const nameSpan = document.createElement("span");
  const extCls = ttdFileExtClass(filename);
  nameSpan.className = `attachName${extCls ? " " + extCls : ""}`;
  nameSpan.textContent = String(filename || "Archivo");

  wrap.appendChild(nameSpan);
  return wrap;
}

// Example function that renders a chat bubble with an attachment
export function createChatRenderer({ chatList, scrollEl, looksMath, asciiToLatex, getHistory, setHistory, shouldAutoScroll }) {
  // ... other renderer code ...

  function renderAttachmentMessage(message) {
    const row = document.createElement("div");
    row.className = "row";

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    // Assuming message.attachment holds the file info
    const filename = message.attachment?.name || "";

    // If the attachment is an image, render differently (not shown here)
    // For non-image attachments (pdf, doc, docx), render with styled filename
    if (filename) {
      // Clear bubble content and append styled filename with prefix icon
      bubble.textContent = "";
      bubble.appendChild(buildAttachmentLabel(filename, "📎 "));
    } else {
      bubble.textContent = "Archivo adjunto";
    }

    row.appendChild(bubble);
    chatList.appendChild(row);
  }

  // ... rest of the createChatRenderer code ...

  return {
    // ... other exposed functions ...
    add: function(message) {
      if (message.attachment && !message.attachment.isImage) {
        renderAttachmentMessage(message);
      } else {
        // existing logic for other messages
      }
    },
    // ... other functions ...
  };
}
</file>
