import { apiFetch } from "../../../shared/js/auth.js";

export function initHistorial({ getTenant, ACTIVE_USER }) {
  let _allTasks = [];

  // ── Drawer elements — L1 (tasks list) ────────────────────────────────────
  const overlay  = document.getElementById("hstDrawerOverlay");
  const panel    = document.getElementById("hstDrawerPanel");
  const closeBtn = document.getElementById("hstDrawerClose");
  const bodyEl   = document.getElementById("hstBody");
  const emptyEl  = document.getElementById("hstEmpty");
  const searchEl  = document.getElementById("hstSearch");
  const subjectEl = document.getElementById("hstSubject");
  const typeEl    = document.getElementById("hstType");

  // ── Drawer elements — L2 (exercises of a task) ───────────────────────────
  const exsOverlay  = document.getElementById("hstExsOverlay");
  const exsPanel    = document.getElementById("hstExsPanel");
  const exsClose    = document.getElementById("hstExsClose");
  const exsBackBtn  = document.getElementById("hstExsBackBtn");
  const exsTitle    = document.getElementById("hstExsTitle");
  const exsMeta     = document.getElementById("hstExsMeta");
  const exsBody     = document.getElementById("hstExsBody");

  // ── Drawer elements — L3 (conversation for one session) ──────────────────
  const convOverlay = document.getElementById("hstConvOverlay");
  const convPanel   = document.getElementById("hstConvPanel");
  const convClose   = document.getElementById("hstConvClose");
  const backBtn     = document.getElementById("hstBackBtn");
  const drawerTitle = document.getElementById("hstDrawerTitle");
  const drawerMeta  = document.getElementById("hstDrawerMeta");
  const drawerBody  = document.getElementById("hstDrawerBody");

  // Hoist overlays to <body> so iOS doesn't clip them inside overflow:hidden parents.
  [overlay, exsOverlay, convOverlay].forEach((el) => {
    if (el && el.parentNode !== document.body) document.body.appendChild(el);
  });

  // ── Open / close helpers ──────────────────────────────────────────────────
  function _openL1() {
    overlay?.classList.add("open");
    panel?.classList.add("open");
    overlay?.removeAttribute("aria-hidden");
  }
  function _closeL1() {
    _closeL2();
    overlay?.classList.remove("open");
    panel?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
  }
  function _openL2() {
    exsOverlay?.classList.add("open");
    exsPanel?.classList.add("open");
    exsOverlay?.removeAttribute("aria-hidden");
    panel?.classList.add("hst-is-stacked");
  }
  function _closeL2() {
    _closeL3();
    exsOverlay?.classList.remove("open");
    exsPanel?.classList.remove("open");
    exsOverlay?.setAttribute("aria-hidden", "true");
    panel?.classList.remove("hst-is-stacked");
  }
  function _openL3() {
    convOverlay?.classList.add("open");
    convPanel?.classList.add("open");
    exsPanel?.classList.add("hst-is-stacked");
  }
  function _closeL3() {
    convOverlay?.classList.remove("open");
    convPanel?.classList.remove("open");
    exsPanel?.classList.remove("hst-is-stacked");
  }

  closeBtn?.addEventListener("click",   _closeL1);
  exsClose?.addEventListener("click",   _closeL2);
  exsBackBtn?.addEventListener("click", _closeL2);
  convClose?.addEventListener("click",  _closeL3);
  backBtn?.addEventListener("click",    _closeL3);
  overlay?.addEventListener("click",    (e) => { if (e.target === overlay)  _closeL1(); });
  exsOverlay?.addEventListener("click", (e) => { if (e.target === exsOverlay) _closeL2(); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (convOverlay?.classList.contains("open")) { _closeL3(); return; }
    if (exsOverlay?.classList.contains("open"))  { _closeL2(); return; }
    if (overlay?.classList.contains("open"))      _closeL1();
  });

  // ── L3: conversation for a specific session ───────────────────────────────
  async function _loadConv(session, taskTitle) {
    const label = session.exercise_title
      ? session.exercise_title
      : session.exercise_index != null
        ? `Ejercicio ${session.exercise_index}`
        : taskTitle || "Conversación";

    if (drawerTitle) drawerTitle.textContent = label;
    const sessionDate = session.session_date
      ? new Date(`${session.session_date}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
      : null;
    const durMin = session.duration_seconds ? Math.round(session.duration_seconds / 60) : null;
    if (drawerMeta) {
      drawerMeta.textContent = [sessionDate, durMin ? `${durMin} min` : null].filter(Boolean).join(" · ");
    }
    if (drawerBody) drawerBody.innerHTML = `<p style="color:var(--ink-mute);font-size:13px">Cargando conversación…</p>`;
    _openL3();

    try {
      const res  = await apiFetch(`/api/v1/tutor-sessions/${encodeURIComponent(session.id)}/messages`);
      const body = await res.json().catch(() => ({}));
      const msgs = body?.data?.messages || [];

      if (!drawerBody) return;
      if (!msgs.length) {
        drawerBody.innerHTML = `<p class="hst-no-session">Sin conversación guardada.</p>`;
        return;
      }
      drawerBody.innerHTML = "";
      msgs.forEach((m) => {
        const isTutor = m.role === "assistant";
        const div     = document.createElement("div");
        div.className = "hst-msg" + (isTutor ? " tutor" : "");
        const roleEl  = document.createElement("p");
        roleEl.className   = "hst-msg-role";
        roleEl.textContent = isTutor ? "Tutor" : "Tú";
        const bubble  = document.createElement("div");
        bubble.className   = "hst-msg-bubble";
        bubble.textContent = m.content || "";
        div.appendChild(roleEl);
        div.appendChild(bubble);
        drawerBody.appendChild(div);
      });
    } catch {
      if (drawerBody) drawerBody.innerHTML = `<p class="hst-no-session">No se pudo cargar la conversación.</p>`;
    }
  }

  // ── L2: exercises list for a task ─────────────────────────────────────────
  const outcomeLabel = { completed: "Resuelto", abandoned: "No pude", escalated: "Ayuda profe" };
  const outcomeClass = { completed: "solo",     abandoned: "help",    escalated: "help" };

  async function _loadExercises(task) {
    if (exsTitle) exsTitle.textContent = task.title || "—";
    const due      = task.dueDate
      ? new Date(`${task.dueDate}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
      : null;
    const typeLabel = task.type === "homework" ? "Deberes" : task.type === "exam" ? "Examen" : "Trabajo";
    if (exsMeta) exsMeta.textContent = [task.subjectName, typeLabel, due].filter(Boolean).join(" · ");

    if (exsBody) exsBody.innerHTML = `<p style="color:var(--ink-mute);font-size:13px">Cargando…</p>`;
    _openL2();

    try {
      const res      = await apiFetch(`/api/v1/tutor-sessions/by-task/${encodeURIComponent(task.id)}`);
      const body     = await res.json().catch(() => ({}));
      const sessions = body?.data?.sessions || [];

      if (!exsBody) return;
      if (!sessions.length) {
        exsBody.innerHTML = `<p class="hst-no-session">Sin sesiones guardadas para esta tarea.</p>`;
        return;
      }

      exsBody.innerHTML = "";
      sessions.forEach((s) => {
        const label = s.exercise_title
          ? s.exercise_title
          : s.exercise_index != null
            ? `Ejercicio ${s.exercise_index}`
            : task.title || "Sesión";

        const sessionDate = s.session_date
          ? new Date(`${s.session_date}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })
          : null;
        const durMin = s.duration_seconds ? Math.round(s.duration_seconds / 60) : null;

        const row = document.createElement("div");
        row.className = "hst-ex-row";
        row.setAttribute("role", "button");
        row.setAttribute("tabindex", "0");
        row.style.cursor = "pointer";

        const oc = s.outcome || "abandoned";
        row.innerHTML = `
          <div class="hst-ex-row-left">
            <span class="hst-ex-label">${label}</span>
            <span class="hst-ex-meta">${[sessionDate, durMin ? `${durMin} min` : null].filter(Boolean).join(" · ")}</span>
          </div>
          <span class="dd-status ${outcomeClass[oc] || "pend"}">
            <span class="dd-status-dot"></span>
            <span>${outcomeLabel[oc] || oc}</span>
          </span>`;

        const onClick = () => _loadConv(s, task.title);
        row.addEventListener("click", onClick);
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
        });
        exsBody.appendChild(row);
      });
    } catch {
      if (exsBody) exsBody.innerHTML = `<p class="hst-no-session">No se pudieron cargar los ejercicios.</p>`;
    }
  }

  // ── L1 filters + rendering ─────────────────────────────────────────────────
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
    const sessLabel = task.sessionCount > 0
      ? `<span class="hst-sessions-badge">${task.sessionCount} ejercicio${task.sessionCount !== 1 ? "s" : ""} trabajado${task.sessionCount !== 1 ? "s" : ""}</span>`
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
        ${sessLabel}
      </div>`;

    li.addEventListener("click", () => _loadExercises(task));
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); _loadExercises(task); }
    });
    return li;
  }

  function _render() {
    if (!bodyEl) return;
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

  // ── Data fetch ─────────────────────────────────────────────────────────────
  async function _fetch() {
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
          id:           t.id,
          type:         t.type,
          title:        t.title || "",
          dueDate:      t.due_date || "",
          subjectName:  t.subject_name || "",
          myStatus:     t.my_status || null,
          attachments:  t.attachments || [],
          sessionCount: t.session_count || 0,
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

  // ── Public API ─────────────────────────────────────────────────────────────
  async function open() {
    _openL1();
    await _fetch();
  }

  return { open };
}
