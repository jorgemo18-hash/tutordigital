export function initNotaProfesor({ apiFetch, getActiveSessionId }) {
  const btnNota   = document.getElementById("btnNotaProfesor");
  const notaPanel = document.getElementById("notaProfesorPanel");
  const notaText  = document.getElementById("notaProfesorText");
  const btnEnviar = document.getElementById("btnEnviarNota");
  let _notaSent = false;

  function showNotaRow() {
    _notaSent = false;
    if (btnNota)   { btnNota.classList.remove("v-hidden"); btnNota.textContent = "📝 Nota al profesor"; btnNota.disabled = false; }
    if (notaPanel) notaPanel.classList.add("v-hidden");
    if (notaText)  notaText.value = "";
  }
  function hideNotaRow() {
    if (btnNota)   btnNota.classList.add("v-hidden");
    if (notaPanel) notaPanel.classList.add("v-hidden");
  }

  btnNota?.addEventListener("click", () => {
    if (_notaSent) return;
    notaPanel?.classList.remove("v-hidden");
    notaText?.focus();
  });

  btnEnviar?.addEventListener("click", async () => {
    const text = notaText?.value.trim() || "";
    if (!text) return;
    const sessionId = getActiveSessionId();
    if (!sessionId) return;
    btnEnviar.disabled = true;
    btnEnviar.textContent = "Enviando…";
    try {
      const res = await apiFetch("/api/v1/student-notes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ session_id: sessionId, note_text: text }),
      });
      if (res.ok) {
        _notaSent = true;
        if (notaPanel) notaPanel.classList.add("v-hidden");
        if (btnNota)   { btnNota.textContent = "Nota enviada ✓"; btnNota.disabled = true; }
      } else {
        btnEnviar.disabled = false;
        btnEnviar.textContent = "Enviar nota";
      }
    } catch {
      btnEnviar.disabled = false;
      btnEnviar.textContent = "Enviar nota";
    }
  });

  return { showNotaRow, hideNotaRow };
}
