// La nota del alumno para su profesor, atada a la sesión de tutoría.
//
// CUÁNDO SE OFRECE, que es lo que estaba mal. El botón se enseñaba DURANTE
// el ejercicio y `onFinished` lo escondía: justo al pulsar "He terminado" o
// "No he podido" desaparecía. O sea, solo se podía escribir a medias y nunca
// al acabar, que es cuando el alumno sabe qué contar. Resultado: cero notas
// en producción desde que existe la tabla (comprobado el 09/09/2026).
//
// Ahora se ofrece también al terminar, en los DOS casos y siempre opcional
// (idea de Jorge, 09/09): "que salga el he terminado, luego he podido o no
// he podido, y con cada una de ellas que se abra un enviar nota al
// profesor... que sea opcional".
//
// POR QUÉ ACEPTA UN sessionId FIJO. Al terminar, `onFinished` llama a
// `clearActiveSession()`, así que `getActiveSessionId()` ya devuelve null
// cuando el alumno se pone a escribir. La nota sin sesión no se puede
// guardar —y se perdía en silencio— así que quien la pide puede fijar a qué
// sesión pertenece.
export function initNotaProfesor({ apiFetch, getActiveSessionId }) {
  const btnNota   = document.getElementById("btnNotaProfesor");
  const notaPanel = document.getElementById("notaProfesorPanel");
  const notaText  = document.getElementById("notaProfesorText");
  const btnEnviar = document.getElementById("btnEnviarNota");
  let _notaSent = false;
  // Sesión a la que se atará la nota cuando la activa ya se ha limpiado.
  let _sessionFijada = null;

  function showNotaRow({ sessionId = null, etiqueta = "📝 Nota al profesor", pista = "", abierto = false } = {}) {
    _notaSent = false;
    _sessionFijada = sessionId;
    if (btnNota)   { btnNota.classList.remove("v-hidden"); btnNota.textContent = etiqueta; btnNota.disabled = false; }
    if (notaText)  { notaText.value = ""; if (pista) notaText.placeholder = pista; }
    if (notaPanel) notaPanel.classList.toggle("v-hidden", !abierto);
    if (abierto) { try { notaText?.focus({ preventScroll: true }); } catch { notaText?.focus(); } }
  }
  function hideNotaRow() {
    _sessionFijada = null;
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
    // La fijada manda: al terminar, la sesión activa ya se ha limpiado.
    const sessionId = _sessionFijada || getActiveSessionId();
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
