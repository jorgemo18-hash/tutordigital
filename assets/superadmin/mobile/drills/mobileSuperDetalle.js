// mobileSuperDetalle.js — Drill-in: detalle de centro. Alumnos/Docentes
// (recuentos) vienen de GET .../stats; Últimos alumnos y Docentes (listas)
// de GET .../students (últimos 5) y GET .../teachers. Grupos y Sesiones/mes
// no tienen fuente en el backend todavía (TODO).

import { icon } from "../../../admin/mobile/mobileAdminIcons.js";
import { TYPE_LABEL, estadoBadgeHtml } from "../mobileSuperShared.js";
import {
  fetchTenantStats, fetchTenantAdmin, fetchTenantStudents, fetchTenantTeachers,
  patchTenant, deleteTenant, impersonateTenant,
} from "../mobileSuperData.js";

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function _fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function _fmtRelative(iso) {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  return `hace ${Math.floor(days / 30)} meses`;
}

function _studentRowHtml(s) {
  const name = s.display_name || `${s.first_name || ""} ${s.last_name || ""}`.trim() || "—";
  return `
    <div class="smini-row">
      <div class="pav">${_esc(name[0]?.toUpperCase() || "?")}</div>
      <div class="pinfo">
        <span class="pname">${_esc(name)}</span>
      </div>
      <span class="smini-tag">${_esc(_fmtRelative(s.created_at))}</span>
    </div>`;
}

function _teacherRowHtml(t) {
  return `
    <div class="smini-row">
      <div class="pav">${_esc((t.display_name || t.email || "?")[0].toUpperCase())}</div>
      <div class="pinfo">
        <span class="pname">${_esc(t.display_name || "—")}</span>
        <span class="pmail">${_esc(t.email || "")}</span>
      </div>
      <span class="smini-tag">${t.num_subjects ? `${t.num_subjects} materia${t.num_subjects !== 1 ? "s" : ""}` : ""}</span>
    </div>`;
}

export async function renderSuperDetalle({ hostEl, tenant, onBack, onDeleted, onUpdated }) {
  let estado = tenant.status || "active";

  hostEl.innerHTML = `
    <div class="drill">
      <header class="drill-head">
        <button class="iconbtn bordered" id="sdBack" aria-label="Volver">${icon("arrowL", { size: 20 })}</button>
        <div class="drill-head-info">
          <div class="drill-head-pill">Detalle de centro</div>
          <div class="drill-head-title">${_esc(tenant.name)}</div>
        </div>
      </header>
      <div class="drill-body">
        <div class="shero">
          <div class="shero-av">${_esc((tenant.name || "?")[0].toUpperCase())}</div>
          <div class="shero-info">
            <div class="shero-name">${_esc(tenant.name)}</div>
            <div class="shero-meta" id="sdEstadoMeta">${estadoBadgeHtml(estado)}<span class="shero-slug">${_esc(tenant.slug)}</span></div>
          </div>
        </div>

        <button class="impersonate" id="sdImpersonateBtn" type="button">Entrar como admin ${icon("enter", { size: 16 })}</button>

        <div class="smetrics" id="sdMetrics">
          <div class="smetric"><span class="smetric-eye">Alumnos</span><span class="smetric-num">—</span><span class="smetric-foot"></span></div>
          <div class="smetric"><span class="smetric-eye">Docentes</span><span class="smetric-num">—</span><span class="smetric-foot"></span></div>
          <div class="smetric featured"><span class="smetric-eye">Grupos</span><span class="smetric-num">—</span><span class="smetric-foot">Sin fuente aún</span></div>
          <div class="smetric"><span class="smetric-eye">Sesiones / mes</span><span class="smetric-num">—</span><span class="smetric-foot">Sin fuente aún</span></div>
        </div>

        <div class="gblock">
          <div class="gblock-head"><div class="gblock-title">Información</div></div>
          <div class="sinfo-eye">Datos del centro</div>
          <dl class="sdl">
            <div class="sdl-row"><dt class="sdt">Tipo</dt><dd class="sdd">${_esc(TYPE_LABEL[tenant.type] || "—")}</dd></div>
            <div class="sdl-row"><dt class="sdt">Slug</dt><dd class="sdd mono">${_esc(tenant.slug)}</dd></div>
            <div class="sdl-row"><dt class="sdt">Creado</dt><dd class="sdd">${_esc(_fmtDate(tenant.created_at))}</dd></div>
          </dl>
          <div class="sinfo-eye">Administrador</div>
          <dl class="sdl" id="sdAdminDl">
            <div class="sdl-row"><dt class="sdt">Nombre</dt><dd class="sdd">Cargando…</dd></div>
          </dl>
        </div>

        <div class="gblock">
          <div class="gblock-head"><div class="gblock-title">Últimos alumnos</div></div>
          <div id="sdStudents"><div class="dcard-empty">Cargando…</div></div>
        </div>

        <div class="gblock">
          <div class="gblock-head"><div class="gblock-title">Docentes</div></div>
          <div id="sdTeachers"><div class="dcard-empty">Cargando…</div></div>
        </div>

        <div class="gblock">
          <div class="gblock-head"><div class="gblock-title">Zona de administración</div></div>
          <div class="danger-zone">
            <div class="danger-row">
              <select class="sselect" id="sdEstadoSelect">
                <option value="active"${estado === "active" ? " selected" : ""}>Activo</option>
                <option value="trial"${estado === "trial" ? " selected" : ""}>Prueba</option>
                <option value="inactive"${estado === "inactive" ? " selected" : ""}>Pausado</option>
                <option value="pending"${estado === "pending" ? " selected" : ""}>Pendiente</option>
              </select>
              <button class="btn-save" id="sdSaveBtn" type="button">Guardar</button>
            </div>
            <button class="btn-danger" id="sdDeleteBtn" type="button">${icon("trash", { size: 15 })} Eliminar centro</button>
          </div>
        </div>
      </div>
    </div>`;

  hostEl.querySelector("#sdBack").addEventListener("click", onBack);

  hostEl.querySelector("#sdImpersonateBtn").addEventListener("click", async (ev) => {
    const btn = ev.currentTarget;
    btn.disabled = true;
    btn.textContent = "Generando enlace…";
    try {
      const data = await impersonateTenant(tenant.slug);
      if (data?.url) window.open(data.url, "_blank");
      else throw new Error("Sin enlace");
    } catch (err) {
      alert(err?.message || "No se pudo generar el enlace.");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `Entrar como admin ${icon("enter", { size: 16 })}`;
    }
  });

  hostEl.querySelector("#sdSaveBtn").addEventListener("click", async (ev) => {
    const btn = ev.currentTarget;
    const sel = hostEl.querySelector("#sdEstadoSelect");
    btn.disabled = true;
    btn.textContent = "Guardando…";
    try {
      await patchTenant(tenant.slug, { status: sel.value });
      estado = sel.value;
      hostEl.querySelector("#sdEstadoMeta").innerHTML = `${estadoBadgeHtml(estado)}<span class="shero-slug">${_esc(tenant.slug)}</span>`;
      onUpdated({ ...tenant, status: estado });
      btn.textContent = "¡Guardado!";
      setTimeout(() => { btn.textContent = "Guardar"; btn.disabled = false; }, 1500);
    } catch (err) {
      alert(err?.message || "No se pudo actualizar el estado.");
      btn.disabled = false;
      btn.textContent = "Guardar";
    }
  });

  hostEl.querySelector("#sdDeleteBtn").addEventListener("click", async () => {
    const typed = prompt(`Esta acción mueve "${tenant.name}" a la papelera (30 días para restaurar).\n\nEscribe el nombre exacto del centro para confirmar:`);
    if (typed === null) return;
    if (typed.trim() !== tenant.name) { alert("El nombre no coincide. No se ha eliminado el centro."); return; }
    try {
      await deleteTenant(tenant.slug);
      onDeleted(tenant.slug);
    } catch (err) {
      alert(err?.message || "No se pudo eliminar el centro.");
    }
  });

  // ── Datos asíncronos: recuentos + administrador ────────────────────────
  fetchTenantStats(tenant.slug).then(stats => {
    const metricsEl = hostEl.querySelector("#sdMetrics");
    if (!metricsEl) return;
    const nums = metricsEl.querySelectorAll(".smetric-num");
    nums[0].textContent = stats.students ?? "—";
    nums[1].textContent = stats.teachers ?? "—";
  }).catch(() => {});

  fetchTenantAdmin(tenant.slug).then(ad => {
    const dl = hostEl.querySelector("#sdAdminDl");
    if (!dl) return;
    dl.innerHTML = `
      <div class="sdl-row"><dt class="sdt">Nombre</dt><dd class="sdd">${_esc(ad.display_name || "—")}</dd></div>
      <div class="sdl-row"><dt class="sdt">Email</dt><dd class="sdd mono">${_esc(ad.email || "—")}</dd></div>
      <div class="sdl-row"><dt class="sdt">Teléfono</dt><dd class="sdd mono">${_esc(ad.phone || "—")}</dd></div>`;
  }).catch(() => {
    const dl = hostEl.querySelector("#sdAdminDl");
    if (dl) dl.innerHTML = `<div class="sdl-row"><dt class="sdt">Administrador</dt><dd class="sdd">Sin administrador activo</dd></div>`;
  });

  fetchTenantStudents(tenant.slug).then(data => {
    const el = hostEl.querySelector("#sdStudents");
    if (!el) return;
    const items = data?.items || [];
    el.innerHTML = items.length
      ? `<div class="smini">${items.map(_studentRowHtml).join("")}</div>`
      : `<div class="dcard-empty">Aún no hay alumnos en este centro.</div>`;
  }).catch(() => {
    const el = hostEl.querySelector("#sdStudents");
    if (el) el.innerHTML = `<div class="dcard-empty">No se pudo cargar el listado.</div>`;
  });

  fetchTenantTeachers(tenant.slug).then(data => {
    const el = hostEl.querySelector("#sdTeachers");
    if (!el) return;
    const items = data?.items || [];
    el.innerHTML = items.length
      ? `<div class="smini">${items.map(_teacherRowHtml).join("")}</div>`
      : `<div class="dcard-empty">Aún no hay docentes en este centro.</div>`;
  }).catch(() => {
    const el = hostEl.querySelector("#sdTeachers");
    if (el) el.innerHTML = `<div class="dcard-empty">No se pudo cargar el listado.</div>`;
  });
}
