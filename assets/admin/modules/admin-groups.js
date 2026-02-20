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
    const fromField = String(g?.track || "").trim().toUpperCase();
    if (fromField && /^[A-Z]$/.test(fromField)) return fromField;
    const hay = String(groupDisplay(g) || "").trim().toUpperCase();
    const m = hay.match(/\b([A-Z])\b$/);
    return m?.[1] || "";
  }

  function findGroupByStageYearTrack(stage, year, track) {
    const y = Number(year);
    const t = String(track || "").toUpperCase();
    return state.allGroups.find((g) => {
      const gs = inferStage(g);
      const gy = inferYear(g);
      const gt = inferTrack(g);
      return gs === stage && gy === y && (!t || gt === t);
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
    if (current && tracks.includes(current)) trackSelect.value = current;
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

  function toggleSelectGroupId(id) {
    if (state.selectedGroupIds.has(id)) state.selectedGroupIds.delete(id);
    else state.selectedGroupIds.add(id);
    if (!state.selectedGroupIds.has(tutorGroupSelect.value)) tutorGroupSelect.value = "";
    renderGroupChips();
    renderTutorOptions();
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

    groupsHint.textContent = stage === "primaria"
      ? `Añade grupos para ${year}º Primaria (A–E). Solo grupos existentes.`
      : `Añade grupos para ${year}º ${stageLabelFor(stage)} (A–E). Solo grupos existentes.`;
    renderGroupChips();
    renderTutorOptions();
  }

  async function loadGroups() {
    try {
      const data = await apiFetch(`/api/v1/groups?limit=${maxLimit}&offset=0`);
      state.allGroups = Array.isArray(data) ? data : (data?.items || []);
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
      const track = String(trackSelect.value || "").trim();
      if (!track) return;
      trackSelect.value = "";

      const stage = stageSelect.value;
      const year = yearSelect.value;
      if (!stage || !year) return;
      const grp = findGroupByStageYearTrack(stage, year, track);
      const realId = grp ? groupId(grp) : null;
      if (!realId) {
        setError(`No existe ${year}º ${stageLabelFor(stage)} ${track} en backend. Crea primero el grupo.`);
        return;
      }
      state.selectedGroupIds.add(realId);
      renderGroupChips();
      renderTutorOptions();
      setError("");
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
