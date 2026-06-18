// ── Admin: aprobación de alumnos pendientes ────────────────────────────────
// Gestiona la lista de alumnos pendientes de aprobación. Usada tanto por la
// pestaña Alumnos de escritorio como por el sheet de "Pendientes" móvil —
// cada llamador pasa sus propios elementos en vez de que este módulo los
// busque por id, así una sola implementación sirve a los dos.

export function initAdminStudentApproval({ fetchJSON, escHtml, listEl, countEl, errorEl }) {

  // ── Helpers ───────────────────────────────────────────────────────────────

  function setError(msg) {
    if (errorEl) errorEl.textContent = msg || "";
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("es-ES", {
        day: "2-digit", month: "short", year: "numeric",
      });
    } catch {
      return iso;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function render(items) {
    if (!listEl) return;

    if (countEl) {
      countEl.textContent = items.length > 0 ? String(items.length) : "";
      countEl.hidden = items.length === 0;
    }

    if (!items.length) {
      listEl.innerHTML = '<p class="emptyState">No hay alumnos pendientes de aprobación.</p>';
      return;
    }

    listEl.innerHTML = items.map((s) => {
      const groupName = s.groups?.name || "Sin grupo";
      return `
        <div class="studentRow pendingRow" data-student-id="${escHtml(s.id)}">
          <div>
            <div class="studentEmail">${escHtml(s.display_name || s.id)}</div>
            <div class="studentMeta">${escHtml(groupName)} · ${formatDate(s.created_at)}</div>
          </div>
          <span class="statusBadge status-pending">pendiente</span>
          <div class="row" style="gap:6px">
            <button class="btn primary small" data-approve="${escHtml(s.id)}">Aprobar</button>
            <button class="btn ghost small"   data-reject="${escHtml(s.id)}">Rechazar</button>
          </div>
        </div>`;
    }).join("");
  }

  // ── API calls ─────────────────────────────────────────────────────────────

  async function load() {
    if (!listEl) return;
    setError("");
    listEl.innerHTML = '<p class="emptyState">Cargando…</p>';

    try {
      const data = await fetchJSON("/api/v1/admin/students/pending");
      const items = Array.isArray(data?.items) ? data.items : [];
      render(items);
    } catch (err) {
      setError(err?.message || "No se pudo cargar la lista de pendientes.");
      listEl.innerHTML = "";
    }
  }

  async function approve(studentId) {
    if (!window.confirm("¿Aprobar el acceso de este alumno?")) return;
    setError("");
    try {
      await fetchJSON(`/api/v1/admin/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      await load();
    } catch (err) {
      setError(err?.message || "No se pudo aprobar al alumno.");
    }
  }

  async function reject(studentId) {
    const reason = window.prompt("Motivo del rechazo (opcional):");
    if (reason === null) return; // cancelado
    setError("");
    try {
      await fetchJSON(`/api/v1/admin/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: reason.trim() }),
      });
      await load();
    } catch (err) {
      setError(err?.message || "No se pudo rechazar al alumno.");
    }
  }

  // ── Event delegation ──────────────────────────────────────────────────────

  function wireEvents() {
    listEl?.addEventListener("click", (ev) => {
      const approveBtn = ev.target.closest("[data-approve]");
      if (approveBtn) { approve(approveBtn.dataset.approve).catch(console.error); return; }

      const rejectBtn = ev.target.closest("[data-reject]");
      if (rejectBtn) { reject(rejectBtn.dataset.reject).catch(console.error); }
    });
  }

  wireEvents();

  return { load };
}
