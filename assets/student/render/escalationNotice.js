// escalationNotice.js — banner informativo en el chat cuando el servidor
// marca needs_help=true en la sesión activa (ver server/routes/v1/chat.routes.js,
// evento SSE "escalate"). Distinto de addTeacherCTA (chatRenderer.js): esto es
// puramente informativo, sin botón — el alumno no tiene que hacer nada.
export function createEscalationNotice({ chatList, scrollEl, isNearBottom, autoScrollEnabled }) {
  function addEscalationNotice(reason, { autoScroll } = {}) {
    if (!chatList) return null;

    const row = document.createElement("div");
    row.className = "row a";

    const card = document.createElement("div");
    card.className = "bubble escalationNotice";

    const title = document.createElement("div");
    title.className = "escalationNoticeTitle";
    title.textContent = "Tu profesor va a revisar esto contigo";

    const body = document.createElement("div");
    body.className = "escalationNoticeBody";
    body.textContent = "Sigue con el ejercicio si quieres — no hace falta que esperes, te avisará cuando lo vea.";

    card.appendChild(title);
    card.appendChild(body);
    row.appendChild(card);

    const allowAuto = autoScroll !== false && autoScrollEnabled({ phase: "escalate" });
    const nearBottom = allowAuto && isNearBottom(140);
    chatList.appendChild(row);

    if (nearBottom) {
      requestAnimationFrame(() => {
        try { scrollEl.scrollTop = scrollEl.scrollHeight; } catch {}
      });
    }

    return row;
  }

  return { addEscalationNotice };
}
