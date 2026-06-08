import { apiFetch } from "../../../shared/js/auth.js";

export function initHistorial({ getTenant, ACTIVE_USER }) {
  let _allTasks = [];

  // ── Drawer elements ──────────────────────────────────────────────────────
  const overlay   = document.getElementById("hstDrawerOverlay");
  const panel     = document.getElementById("hstDrawerPanel");
  const closeBtn  = document.getElementById("hstDrawerClose");
  const convClose = document.getElementById("hstConvClose");
  const backBtn   = document.getElementById("hstBackBtn");
  const listView  = document.getElementById("hstListView");
  const convView  = document.getElementById("hstConvView");

  // List view
  const searchEl  = document.getElementById("hstSearch");
  const subjectEl = document.getElementById("hstSubject");
  const typeEl    = document.getElementById("hstType");
  const bodyEl    = document.getElementById("hstBody");
  const emptyEl   = document.getElementById("hstEmpty");

  // Conversation view
  const drawerStatus      = document.getElementById("hstDrawerStatus");
  const drawerStatusLabel = document.getElementById("hstDrawerStatusLabel");
  const drawerTitle       = document.getElementById("hstDrawerTitle");
  const drawerMeta        = document.getElementById("hstDrawerMeta");
  const drawerBody        = document.getElementById("hstDrawerBody");

  // ── Open / close ─────────────────────────────────────────────────────────
  function _openOverlay() {
    overlay?.classList.add("open");
    panel?.classList.add("open");
    overlay?.removeAttribute("aria-hidden");
  }
  function _closeOverlay() {
    overlay?.classList.remove("open");
    panel?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
  }
  function _showList() {
    listView?.classList.remove("v-hidden");
    convView?.classList.add("v-hidden");
  }
  function _showConv() {
    listView?.classList.add("v-hidden");
    convView?.classList.remove("v-hidden");
  }

  closeBtn?.addEventListener("click", _closeOverlay);
  convClose?.addEventListener("click", _closeOverlay);
  backBtn?.addEventListener("click", _showList);
  overlay?.addEventListener("click", (e) => { if (e.target === overlay) _closeOverlay(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay?.classList.contains("open")) _closeOverlay();
  });

  // ── Conversation view ─────────────────────────────────────────────────────
  async function _loadConv(task) {
    if (drawerTitle) drawerTitle.textContent = task.title || "—";

    const due = task.dueDate
      ? new Date(`${task.dueDate}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
      : null;
    const typeLabel = task.type === "homework" ? "Deberes" : task.type === "exam" ? "Examen" : "Trabajo";
    if (drawerMeta) drawerMeta.textContent = [task.subjectName, typeLabel, due].filter(Boolean).join(" · ");

    const status = task.myStatus;
    if (drawerStatus) drawerStatus.className = "dd-status " + (status === "done" ? "solo" : status === "needs_teacher" ? "help" : "pend");
    if (drawerStatusLabel) drawerStatusLabel.textContent = status === "done" ? "Resuelto" : status === "needs_teacher" ? "No pude" : "—";

    if (drawerBody) drawerBody.innerHTML = `<p style="color:var(--ink-mute);font-size:13px">Cargando conversación…</p>`;
    _showConv();

    try {
      const res  = await apiFetch(`/api/v1/tutor-sessions/by-task/${encodeURIComponent(task.id)}`);
      const body = await res.json().catch(() => ({}));
      const msgs = body?.data?.messages || [];

      if (!drawerBody) return;
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
      if (drawerBody) drawerBody.innerHTML = `<p class="hst-no-session">No se pudo cargar la conversación.</p>`;
    }
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  function _getFiltered() {
    const q    = (searchEl?.value  || "").trim().toLowerCase();
    const subj = subjectEl?.value  || "";
    const typ  = typeEl?.value     || "";
    return _allTasks.filter((t) => {
      if (q    && !t.title.toLowerCase().includes(q)) return false;
      if (subj && t.subjectName !== subj)             return false;
      if (typ  && t.type        !== typ)              return false;
      return true;
    });
  }

  function _populateSubjects() {
    if (!subjectEl) return;
    const seen = new Set();
    _allTasks.forEach((t) => { if (t.subjectName) seen.add(t.subjectName); });
    const cur = subjectEl.value;
    subjectEl.innerHTML = `<option value="">Todas las asignaturas</option>`;
    [...seen].sort().forEach((s) => {
      const o = document.createElement("option");
      o.value = s; o.textContent = s;
      subjectEl.appendChild(o);
    });
    subjectEl.value = seen.has(cur) ? cur : "";
  }

  // ── Card rendering ────────────────────────────────────────────────────────
  const clockSVG = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

  function slugify(s) {
    return s.toLowerCase()
      .replace(/[áàä]/g,"a").replace(/[éèë]/g,"e").replace(/[íìï]/g,"i")
      .replace(/[óòö]/g,"o").replace(/[úùü]/g,"u")
      .replace(/\s+/g,"-");
  }

  function _renderCard(task) {
    const li = document.createElement("li");
    li.className = "td-card";
    li.setAttribute("role", "button");
    li.setAttribute("tabindex", "0");
    li.style.cursor = "pointer";

    const due      = task.dueDate
      ? new Date(`${task.dueDate}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })
      : null;
    const subLabel = task.subjectName || "";
    const subSlug  = subLabel ? slugify(subLabel) : "";
    const typeBadge = task.type === "exam"
      ? `<span class="td-badge-tipo">Examen</span>`
      : task.type === "work"
      ? `<span class="td-badge-tipo">Trabajo</span>`
      : "";
    const resultBadge = task.myStatus === "done"
      ? `<span class="hst-result hst-result--done">Resuelto</span>`
      : task.myStatus === "needs_teacher"
      ? `<span class="hst-result hst-result--stuck">No pude</span>`
      : "";

    li.innerHTML = `
      <div class="td-card-tag-row">
        ${subLabel ? `<span class="td-tag ${subSlug}">${subLabel}</span>` : ""}
        ${typeBadge}
        ${resultBadge}
      </div>
      <div class="td-card-title">
        <span>${task.title}</span>
        ${task.attachments?.length ? `<span class="agendaAttachIndicator">📎 ${task.attachments.length}</span>` : ""}
      </div>
      <div class="td-card-foot">
        ${due ? `<span>${clockSVG} ${due}</span>` : "<span></span>"}
      </div>`;

    li.addEventListener("click", () => _loadConv(task));
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); _loadConv(task); }
    });
    return li;
  }

  // ── List rendering ────────────────────────────────────────────────────────
  function _render() {
    if (!bodyEl) return;
    // Clear old sections / separators
    bodyEl.querySelectorAll(".hst-section, .hst-sep").forEach((el) => el.remove());

    const filtered = _getFiltered();
    const hw = filtered.filter((t) => t.type === "homework");
    const ex = filtered.filter((t) => t.type === "exam");
    const wk = filtered.filter((t) => t.type === "work");

    function addSection(label, items) {
      const sec = document.createElement("div");
      sec.className = "hst-section";
      const lbl = document.createElement("p");
      lbl.className = "td-col-subsection-label";
      lbl.textContent = label;
      const ul = document.createElement("ul");
      ul.className = "items";
      items.forEach((t) => ul.appendChild(_renderCard(t)));
      sec.appendChild(lbl);
      sec.appendChild(ul);
      bodyEl.insertBefore(sec, emptyEl);
    }

    function addSep() {
      const sep = document.createElement("div");
      sep.className = "td-col-separator hst-sep";
      bodyEl.insertBefore(sep, emptyEl);
    }

    const groups = [[hw, "Deberes"], [ex, "Exámenes"], [wk, "Trabajos"]].filter(([arr]) => arr.length);
    groups.forEach(([arr, label], i) => {
      if (i > 0) addSep();
      addSection(label, arr);
    });

    const total = hw.length + ex.length + wk.length;
    emptyEl?.classList.toggle("v-hidden", total > 0);
  }

  searchEl?.addEventListener("input",  _render);
  subjectEl?.addEventListener("change", _render);
  typeEl?.addEventListener("change",   _render);

  // ── Data fetch ────────────────────────────────────────────────────────────
  async function _fetch() {
    // Show loading state
    bodyEl?.querySelectorAll(".hst-section, .hst-sep, .hst-loading").forEach((el) => el.remove());
    if (emptyEl) emptyEl.classList.add("v-hidden");
    const loading = document.createElement("p");
    loading.className = "hst-loading";
    loading.textContent = "Cargando…";
    bodyEl?.insertBefore(loading, emptyEl);

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
          if (t.type === "homework" || t.type === "work") {
            return t.myStatus === "done" || t.myStatus === "needs_teacher";
          }
          if (t.type === "exam") {
            if (!t.dueDate) return false;
            const due = new Date(`${t.dueDate}T00:00:00`); due.setHours(0, 0, 0, 0);
            return due < today;
          }
          return false;
        });

      _populateSubjects();
    } catch {
      _allTasks = [];
    } finally {
      bodyEl?.querySelector(".hst-loading")?.remove();
    }

    _render();
  }

  // ── Public API ────────────────────────────────────────────────────────────
  async function open() {
    _showList();
    _openOverlay();
    await _fetch();
  }

  return { open };
}
