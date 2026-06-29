import { apiFetch } from "../../../shared/js/auth.js";
import { escHtml, relativeDate } from "./helpers.js";
import { showToast } from "./toast.js";

export async function patchTenant(slug, data) {
  try {
    const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (res.status === 404 || res.status === 405) { showToast("Función no disponible aún"); return false; }
    if (!res.ok) { showToast("Error al guardar"); return false; }
    return true;
  } catch { showToast("Error de red"); return false; }
}

export async function patchAdmin(slug, data) {
  try {
    const res = await apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}/admin`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (res.status === 404) { showToast("No hay administrador activo en este centro"); return false; }
    if (!res.ok) { showToast("Error al guardar"); return false; }
    return true;
  } catch { showToast("Error de red"); return false; }
}

export async function loadPeople(slug) {
  const [studRes, teachRes] = await Promise.allSettled([
    apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}/students`),
    apiFetch(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}/teachers`),
  ]);
  let students = [], teachers = [];
  if (studRes.status === "fulfilled" && studRes.value.ok) {
    const d = await studRes.value.json().catch(() => ({}));
    students = d?.data?.items || [];
  }
  if (teachRes.status === "fulfilled" && teachRes.value.ok) {
    const d = await teachRes.value.json().catch(() => ({}));
    teachers = d?.data?.items || [];
  }

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("cdKpiAlumnos",  students.length || "—");
  set("cdKpiDocentes", teachers.length || "—");

  const sBody = document.getElementById("cdStudentsBody");
  if (sBody) sBody.innerHTML = students.slice(0, 5).length
    ? students.slice(0, 5).map(s => {
        const init = (s.display_name || s.email || "?")[0].toUpperCase();
        return `<div class="sa-mini-row">
          <div class="sa-mini-av">${escHtml(init)}</div>
          <div class="sa-mini-info">
            <span class="sa-mini-name">${escHtml(s.display_name || s.email || "—")}</span>
            <span class="sa-mini-sub">${relativeDate(s.last_seen || s.created_at)}</span>
          </div>
        </div>`;
      }).join("")
    : `<div class="sa-mini-empty">Sin alumnos aún</div>`;

  const tBody = document.getElementById("cdTeachersBody");
  if (tBody) tBody.innerHTML = teachers.length
    ? teachers.map(t => {
        const init = (t.display_name || t.email || "?")[0].toUpperCase();
        return `<div class="sa-mini-row">
          <div class="sa-mini-av sa-mini-av--teacher">${escHtml(init)}</div>
          <div class="sa-mini-info">
            <span class="sa-mini-name">
              ${escHtml(t.display_name || "—")}
              ${t.is_admin ? `<span class="sa-mini-badge">Admin</span>` : ""}
            </span>
            <span class="sa-mini-sub">${escHtml(t.email || "—")}</span>
          </div>
          <span class="sa-mini-tag">${t.subjects_count ? `${t.subjects_count} materias` : ""}</span>
        </div>`;
      }).join("")
    : `<div class="sa-mini-empty">Sin docentes aún</div>`;
}
