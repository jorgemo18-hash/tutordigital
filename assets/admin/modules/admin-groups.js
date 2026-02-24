export function initAdminGroups({
  apiFetch,
  els,
  state,
  opts = {},
}) {
  const {
    stageSelect,
    yearSelect,
    trackSelect,
    customTrackWrap,
    customTrackInput,
    trackPills,
    groupGrid,
    groupChips,
    groupsHint,
    tutorGroupSelect,
  } = els;

  const {
    maxLimit = 500,
    tracks = ["A", "B", "C", "D", "E"],
    onSelectionChange = null,
  } = opts;

  const rootInitKey = "adminGroupsInit";
  const initRoot = document.documentElement;
  if (initRoot?.dataset?.[rootInitKey] === "1") {
    return {
      loadGroups: async () => {},
      renderGroupsUI: () => {},
      renderTutorOptions: () => {},
    };
  }

  const DEBUG = (
    (typeof window !== "undefined" && window.__TTD_DEBUG__ === true)
    || (typeof localStorage !== "undefined" && localStorage.getItem("ttd_debug") === "1")
  );
  const dlog = (...args) => { if (DEBUG) console.debug(...args); };

  function stageYears(stage) {
    if (stage === "primaria") return [1, 2, 3, 4, 5, 6];
    if (stage === "eso") return [1, 2, 3, 4];
    return [1, 2];
  }

  function stageLabelFor(stage) {
    if (stage === "primaria") return "Primaria";
    if (stage === "eso") return "ESO";
    return "Bachillerato";
  }

  function normalizeCmp(s) {
    return String(s || "").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeTrackLabel(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toUpperCase()
      .replace(/\s/g, "-")
      .replace(/[^A-Z0-9_-]/g, "")
      .slice(0, 16);
  }

  function groupId(g) {
    return g?.id || g?.group_id || g?.slug || g?.code || null;
  }

  function groupDisplay(g) {
    return g?.display || g?.name || g?.label || g?.title || g?.slug || g?.id || "Grupo";
  }

  function inferStage(g) {
    const level = normalizeCmp(g?.level || g?.stage || "");
    if (level.includes("prim")) return "primaria";
    if (level.includes("eso") || level.includes("secund")) return "eso";
    if (level.includes("bach")) return "bachiller";
    const hay = normalizeCmp(groupDisplay(g));
    if (hay.includes("primaria")) return "primaria";
    if (hay.includes("eso") || hay.includes("secund")) return "eso";
    if (hay.includes("bach")) return "bachiller";
    return "";
  }

  function inferYear(g) {
    const fromField = Number(g?.year || 0);
    if (Number.isInteger(fromField) && fromField >= 1 && fromField <= 6) return fromField;
    const hay = normalizeCmp(groupDisplay(g));
    const m = hay.match(/\b([1-6])\s*(?:º|o)?\b/);
    return m ? Number(m[1]) : 0;
  }

  function inferTrack(g) {
    const fromField = normalizeTrackLabel(g?.track || "");
    if (fromField) return fromField;
    const byNorm = String(g?.normalized_name || "").trim();
    if (byNorm.includes("|")) {
      const pieces = byNorm.split("|");
      const candidate = normalizeTrackLabel(pieces[pieces.length - 1]);
      if (candidate) return candidate;
    }
    const hay = String(groupDisplay(g) || "").trim().toUpperCase();
    const dashed = hay.match(/-\s*([A-Z0-9_-]{1,16})$/);
    if (dashed?.[1]) return normalizeTrackLabel(dashed[1]);
    const tail = hay.match(/\b([A-Z0-9_-]{1,16})\b$/);
    return normalizeTrackLabel(tail?.[1] || "");
  }

  function normalizedGroupKey(stage, year, track) {
    return `${String(stage || "").trim()}|${Number(year) || ""}|${normalizeTrackLabel(track)}`.toLowerCase();
  }

  function displayNameFor(stage, year, track) {
    return `${year}º ${stageLabelFor(stage)} - ${normalizeTrackLabel(track)}`;
  }

  function findGroupByStageYearTrack(stage, year, track) {
    const y = Number(year);
    const t = normalizeTrackLabel(track);
    const normalized = normalizedGroupKey(stage, y, t);
    return state.allGroups.find((g) => {
      const gNorm = String(g?.normalized_name || "").toLowerCase();
      if (gNorm && gNorm === normalized) return true;
      const gs = inferStage(g);
      const gy = inferYear(g);
      const gt = inferTrack(g);
      return gs === stage && gy === y && gt === t;
    });
  }

  function setError(msg) {
    if (els.adminError) els.adminError.textContent = msg || "";
  }

  function notifySelectionChange() {
    if (typeof onSelectionChange === "function") onSelectionChange();
  }

  function renderYearSelect() {
    const stage = stageSelect.value;
    const years = stageYears(stage);
    const current = String(yearSelect.value || "");
    yearSelect.innerHTML = "";
    years.forEach((y) => {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = `${y}º`;
      yearSelect.appendChild(opt);
    });
    if (current && years.includes(Number(current))) yearSelect.value = current;
    if (!yearSelect.value) yearSelect.selectedIndex = 0;
  }

  function renderTrackSelect() {
    if (!trackSelect) return;
    const current = String(trackSelect.value || "");
    trackSelect.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "Grupo…";
    trackSelect.appendChild(ph);

    tracks.forEach((track) => {
      const opt = document.createElement("option");
      opt.value = track;
      opt.textContent = track;
      trackSelect.appendChild(opt);
    });

    const custom = document.createElement("option");
    custom.value = "__CUSTOM__";
    custom.textContent = "Otro…";
    trackSelect.appendChild(custom);

    if (current && [...tracks, "__CUSTOM__"].includes(current)) trackSelect.value = current;
  }

  function updateCustomTrackVisibility() {
    if (!customTrackWrap || !customTrackInput || !trackSelect) return;
    const isCustom = String(trackSelect.value || "") === "__CUSTOM__";
    customTrackWrap.classList.toggle("hidden", !isCustom);
    if (isCustom) {
      customTrackInput.focus();
    } else {
      customTrackInput.value = "";
    }
  }

  function renderTutorOptions() {
    const current = tutorGroupSelect.value;
    tutorGroupSelect.innerHTML = '<option value="">Sin tutoría</option>';
    [...state.selectedGroupIds].forEach((id) => {
      const g = state.allGroups.find((x) => groupId(x) === id);
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = g ? groupDisplay(g) : id;
      tutorGroupSelect.appendChild(opt);
    });
    if ([...state.selectedGroupIds].includes(current)) tutorGroupSelect.value = current;
    else tutorGroupSelect.value = "";
    notifySelectionChange();
  }

  function renderGroupChips() {
    groupChips.innerHTML = "";
    [...state.selectedGroupIds].forEach((id) => {
      const g = state.allGroups.find((x) => groupId(x) === id);
      const chip = document.createElement("div");
      chip.className = "chip";
      const span = document.createElement("span");
      span.textContent = g ? groupDisplay(g) : id;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "×";
      btn.addEventListener("click", () => {
        state.selectedGroupIds.delete(id);
        if (tutorGroupSelect.value === id) tutorGroupSelect.value = "";
        renderGroupChips();
        renderTutorOptions();
        renderGroupsUI();
      });
      chip.append(span, btn);
      groupChips.appendChild(chip);
    });
    notifySelectionChange();
  }

  async function ensureGroup(stage, year, track) {
    const trackNorm = normalizeTrackLabel(track);
    const payload = {
      stage,
      year: Number(year),
      track: trackNorm,
      level: stage,
      name: displayNameFor(stage, year, trackNorm),
      normalized_name: normalizedGroupKey(stage, year, trackNorm),
    };

    const created = await apiFetch("/api/v1/admin/groups/ensure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const id = created ? groupId(created) : null;
    if (id && !state.allGroups.some((x) => groupId(x) === id)) {
      state.allGroups.push(created);
    }
    return created;
  }

  async function addGroupFromTrack(rawTrack) {
    const stage = stageSelect.value;
    const year = yearSelect.value;
    const trackNorm = normalizeTrackLabel(rawTrack);

    if (!stage || !year) return;
    if (!trackNorm) {
      setError("Escribe una etiqueta para 'Otro…'.");
      return;
    }

    let grp = findGroupByStageYearTrack(stage, year, trackNorm);
    try {
      if (!grp) {
        grp = await ensureGroup(stage, year, trackNorm);
      }
    } catch (err) {
      const status = Number(err?.status || 0);
      if (status === 401 || status === 403) {
        setError("No tienes permisos para autocrear grupos. Crea el grupo en backend primero.");
      } else {
        setError("No se pudo crear el grupo. Revisa logs.");
      }
      return;
    }

    const realId = grp ? groupId(grp) : null;
    if (!realId) {
      setError("No se pudo resolver el grupo seleccionado.");
      return;
    }

    state.selectedGroupIds.add(realId);
    renderGroupChips();
    renderTutorOptions();
    setError("");
  }

  function renderGroupsUI() {
    const stage = stageSelect.value;
    const year = yearSelect.value;
    renderTrackSelect();
    if (trackPills) {
      trackPills.classList.add("hidden");
      trackPills.innerHTML = "";
    }
    if (groupGrid) {
      groupGrid.classList.add("hidden");
      groupGrid.innerHTML = "";
    }

    if (groupsHint) groupsHint.textContent = "";

    updateCustomTrackVisibility();
    renderGroupChips();
    renderTutorOptions();
  }

  async function loadGroups() {
    try {
      const all = [];
      let offset = 0;
      while (true) {
        const data = await apiFetch(`/api/v1/groups?limit=${maxLimit}&offset=${offset}`);
        const chunk = Array.isArray(data) ? data : (data?.items || []);
        all.push(...chunk);
        if (chunk.length < maxLimit) break;
        offset += maxLimit;
      }
      state.allGroups = all;

      const total = state.allGroups.length;
      const byStage = state.allGroups.reduce((acc, g) => {
        const key = String(g?.stage || inferStage(g) || "null");
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const byVariant = state.allGroups.reduce((acc, g) => {
        const key = String(g?.variant || "null");
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      dlog("[admin] groups loaded:", total, { byStage, byVariant });
      setError("");
      renderYearSelect();
      renderGroupsUI();
      renderGroupChips();
      renderTutorOptions();
    } catch {
      setError("No se pudo cargar la lista de grupos.");
    }
  }

  if (trackSelect) {
    trackSelect.addEventListener("change", async () => {
      const value = String(trackSelect.value || "").trim();
      if (!value) return;
      if (value === "__CUSTOM__") {
        updateCustomTrackVisibility();
        return;
      }

      trackSelect.value = "";
      updateCustomTrackVisibility();
      await addGroupFromTrack(value);
    });
  }

  if (customTrackInput) {
    customTrackInput.addEventListener("keydown", async (ev) => {
      if (ev.key !== "Enter") return;
      ev.preventDefault();
      if (String(trackSelect?.value || "") !== "__CUSTOM__") return;
      const raw = customTrackInput.value;
      await addGroupFromTrack(raw);
      customTrackInput.value = "";
      if (trackSelect) trackSelect.value = "";
      updateCustomTrackVisibility();
    });
  }

  stageSelect.addEventListener("change", () => {
    renderYearSelect();
    renderGroupsUI();
  });
  yearSelect.addEventListener("change", () => {
    renderGroupsUI();
  });

  if (initRoot) initRoot.dataset[rootInitKey] = "1";
  loadGroups();

  return {
    loadGroups,
    renderGroupsUI,
    renderTutorOptions,
  };
}
