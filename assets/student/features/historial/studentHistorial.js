import { apiFetch } from "../../../shared/js/auth.js";

export function initHistorial({ getTenant, ACTIVE_USER }) {
  let _allTasks = [];
  let _loaded = false;

  const searchEl  = document.getElementById("hstSearch");
  const subjectEl = document.getElementById("hstSubject");
  const typeEl    = document.getElementById("hstType");
  const bodyEl    = document.getElementById("hstBody");
  const emptyEl   = document.getElementById("hstEmpty");

  const secHomework = document.getElementById("hstSectionHomework");
  const listHomework = document.getElementById("hstListHomework");
  const secExam     = document.getElementById("hstSectionExam");
  const listExam    = document.getElementById("hstListExam");
  const secWork     = document.getElementById("hstSectionWork");
  const listWork    = document.getElementById("hstListWork");
  const sepHE       = document.getElementById("hstSepHE");
  const sepEW       = document.getElementById("hstSepEW");

  // ── Drawer ──────────────────────────────────────────────────────────────
  const overlay    = document.getElementById("hstDrawerOverlay");
  const panel      = document.getElementById("hstDrawerPanel");
  const closeBtn   = document.getElementById("hstDrawerClose");
  const drawerTitle  = document.getElementById("hstDrawerTitle");
  const drawerMeta   = document.getElementById("hstDrawerMeta");
  const drawerStatus = document.getElementById("hstDrawerStatus");
  const drawerStatusLabel = document.getElementById("hstDrawerStatusLabel");
  const drawerBody   = document.getElementById("hstDrawerBody");

  function _openDrawer() {
    overlay?.classList.add("open");
    panel?.classList.add("open");
    overlay?.removeAttribute("aria-hidden");
  }
  function _closeDrawer() {
    overlay?.classList.remove("open");
    panel?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
  }
  closeBtn?.addEventListener("click", _closeDrawer);
  overlay?.addEventListener("click", (e) => { if (e.target === overlay) _closeDrawer(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay?.classList.contains("open")) _closeDrawer();
  });

  async function _loadDrawer(task) {
    drawerTitle.textContent = task.title || "—";
    const due = task.dueDate
      ? new Date(`${task.dueDate}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
      : null;
    const metaParts = [task.subjectName, due].filter(Boolean);
    drawerMeta.textContent = metaParts.join(" · ");

    const status = task.myStatus;
    drawerStatus.className = "dd-status " + (status === "done" ? "solo" : status === "needs_teacher" ? "help" : "pend");
    drawerStatusLabel.textContent = status === "done" ? "Completado"
      : status === "needs_teacher" ? "Necesitó ayuda"
      : task.type === "exam" ? "Examen pasado"
      : "Sin estado";

    drawerBody.innerHTML = `<p style="color:var(--ink-mute);font-size:13px">Cargando conversación…</p>`;
    _openDrawer();

    try {
      const res  = await apiFetch(`/api/v1/tutor-sessions/by-task/${encodeURIComponent(task.id)}`);
      const body = await res.json().catch(() => ({}));
      const msgs = body?.data?.messages || [];

      if (!msgs.length) {
        drawerBody.innerHTML = `<p class="hst-no-session">Sin conversación guardada para esta tarea.</p>`;
        return;
      }
      drawerBody.innerHTML = "";
      msgs.forEach((m) => {
        const isTutor = m.role === "assistant";
        const div = document.createElement("div");
        div.className = "hst-msg" + (isTutor ? " tutor" : "");
        const roleEl = document.createElement("p");
        roleEl.className = "hst-msg-role";
        roleEl.textContent = isTutor ? "Tutor" : "Tú";
        const bubble = document.createElement("div");
        bubble.className = "hst-msg-bubble";
        bubble.textContent = m.content || "";
        div.appendChild(roleEl);
        div.appendChild(bubble);
        drawerBody.appendChild(div);
      });
    } catch {
      drawerBody.innerHTML = `<p class="hst-no-session">No se pudo cargar la conversación.</p>`;
    }
  }

  // ── Filters ─────────────────────────────────────────────────────────────
  function _getFiltered() {
    const q = (searchEl?.value || "").trim().toLowerCase();
    const subj = subjectEl?.value || "";
    const typ  = typeEl?.value  || "";
    return _allTasks.filter((t) => {
      if (q    && !t.title.toLowerCase().includes(q)) return false;
      if (subj && t.subjectName !== subj)             return false;
      if (typ  && t.type        !== typ)              return false;
      return true;
    });
  }

  function _populateSubjects() {
    const seen = new Set();
    _allTasks.forEach((t) => { if (t.subjectName) seen.add(t.subjectName); });
    if (!subjectEl) return;
    const cur = subjectEl.value;
    subjectEl.innerHTML = `<option value="">Todas las asignaturas</option>`;
    [...seen].sort().forEach((s) => {
      const o = document.createElement("option");
      o.value = s; o.textContent = s;
      subjectEl.appendChild(o);
    });
    subjectEl.value = seen.has(cur) ? cur : "";
  }

  const tickSVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7aa073" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
  const helpSVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c4834a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  const clockSVG = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

  function _renderCard(task) {
    const li = document.createElement("li");
    li.className = "td-card";
    li.dataset.cardTaskId = task.id;
    li.setAttribute("role", "button");
    li.setAttribute("tabindex", "0");
    li.style.cursor = "pointer";

    const due = task.dueDate
      ? new Date(`${task.dueDate}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })
      : null;
    const subjectLabel = task.subjectName || "";
    const subjectSlug  = subjectLabel ? subjectLabel.toLowerCase().replace(/\s+/g, "-").replace(/[áàä]/g,"a").replace(/[éèë]/g,"e").replace(/[íìï]/g,"i").replace(/[óòö]/g,"o").replace(/[úùü]/g,"u") : "";

    const indicator = task.myStatus === "done" ? tickSVG
      : task.myStatus === "needs_teacher" ? helpSVG
      : "";

    li.innerHTML = `
      <div class="td-card-tag-row">
        ${subjectLabel ? `<span class="td-tag ${subjectSlug}">${subjectLabel}</span>` : ""}
        <span style="margin-left:auto;display:flex;align-items:center">${indicator}</span>
      </div>
      <div class="td-card-title">
        <span>${task.title}</span>
        ${task.attachments?.length ? `<span class="agendaAttachIndicator">📎 ${task.attachments.length}</span>` : ""}
      </div>
      <div class="td-card-foot">
        ${due ? `<span>${clockSVG} ${due}</span>` : "<span></span>"}
      </div>`;
    li.addEventListener("click", () => _loadDrawer(task));
    li.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); _loadDrawer(task); } });
    return li;
  }

  function _render() {
    const filtered = _getFiltered();
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const hw = filtered.filter((t) => t.type === "homework");
    const ex = filtered.filter((t) => t.type === "exam");
    const wk = filtered.filter((t) => t.type === "work");

    function fillSection(section, list, items) {
      if (!section || !list) return;
      if (!items.length) {
        section.style.display = "none";
      } else {
        section.style.display = "";
        list.innerHTML = "";
        items.forEach((t) => list.appendChild(_renderCard(t)));
      }
    }

    fillSection(secHomework, listHomework, hw);
    fillSection(secExam,     listExam,     ex);
    fillSection(secWork,     listWork,     wk);

    // Separadores: solo mostrar si ambas secciones adyacentes tienen datos
    if (sepHE) sepHE.style.display = (hw.length && ex.length) ? "" : "none";
    if (sepEW) sepEW.style.display = (ex.length && wk.length) ? "" : "none";

    const total = hw.length + ex.length + wk.length;
    if (emptyEl) emptyEl.classList.toggle("v-hidden", total > 0);
  }

  searchEl?.addEventListener("input",  _render);
  subjectEl?.addEventListener("change", _render);
  typeEl?.addEventListener("change",   _render);

  // ── Load ────────────────────────────────────────────────────────────────
  async function load() {
    if (listHomework) listHomework.innerHTML = `<li class="agendaLoading">Cargando…</li>`;

    try {
      const res  = await apiFetch("/api/v1/tasks?history=true&limit=500");
      const body = await res.json().catch(() => ({}));
      const raw  = res.ok ? (body?.data?.items || []) : [];
      const today = new Date(); today.setHours(0, 0, 0, 0);

      _allTasks = raw
        .map((t) => ({
          id:          t.id,
          type:        t.type,
          title:       t.title || "",
          dueDate:     t.due_date || "",
          subjectName: t.subject_name || "",
          myStatus:    t.my_status || null,
          attachments: t.attachments || [],
        }))
        .filter((t) => {
          // Historial: deberes y trabajos done/needs_teacher, exámenes con fecha pasada
          if (t.type === "homework") return t.myStatus === "done" || t.myStatus === "needs_teacher";
          if (t.type === "work")     return t.myStatus === "done" || t.myStatus === "needs_teacher";
          if (t.type === "exam") {
            if (!t.dueDate) return false;
            const due = new Date(`${t.dueDate}T00:00:00`); due.setHours(0, 0, 0, 0);
            return due < today;
          }
          return false;
        });

      _loaded = true;
      _populateSubjects();
      _render();
    } catch {
      if (listHomework) listHomework.innerHTML = "";
      if (emptyEl) emptyEl.classList.remove("v-hidden");
    }
  }

  return { load };
}
