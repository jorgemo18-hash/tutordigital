export function initAdminGroups({
  apiFetch,
  els,
  state,
  opts = {},
}) {
  const {
    maxLimit = 500,
    tracks = ["A", "B", "C", "D", "E"],
  } = opts;

  const creatingGroupKeys = new Set();

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

  function groupStageYearTrackMatch(g, stage, year, track) {
    const hay = normalizeCmp(groupDisplay(g) + " " + (g?.slug || "") + " " + (g?.id || ""));
    const yearOk = hay.includes(String(year));
    const stageOk =
      stage === "primaria" ? hay.includes("primaria") :
      stage === "eso" ? (hay.includes("eso") || hay.includes("secund")) :
      (hay.includes("bach") || hay.includes("bachiller"));
    const trackOk = track ? (hay.includes(" " + normalizeCmp(track)) || hay.endsWith(normalizeCmp(track))) : true;
    return stageOk && yearOk && trackOk;
  }

  function findGroupByStageYearTrack(stage, year, track) {
    return state.allGroups.find((g) => groupStageYearTrackMatch(g, stage, year, track));
  }

  async function ensureGroup(stage, year, track) {
    const key = `${stage}|${year}|${track}`;
    if (creatingGroupKeys.has(key)) return null;
    creatingGroupKeys.add(key);
    try {
      const g = await apiFetch("/api/v1/admin/groups/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, year, track }),
      });

      const id = g ? groupId(g) : null;
      if (id && !state.allGroups.some((x) => groupId(x) === id)) state.allGroups.push(g);
      return g;
    } finally {
      creatingGroupKeys.delete(key);
    }
  }

  function setError(msg) {
    if (els.adminError) els.adminError.textContent = msg || "";
  }

  function renderYearSelect() {
    const stage = els.stageSelect.value;
    const years = stageYears(stage);
    els.yearSelect.innerHTML = "";
    years.forEach((y) => {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = `${y}º`;
      els.yearSelect.appendChild(opt);
    });
    els.yearSelect.selectedIndex = 0;
  }

  function renderTutorOptions() {
    const current = els.tutorGroupSelect.value;
    els.tutorGroupSelect.innerHTML = '<option value="">Sin tutoría</option>';
    [...state.selectedGroupIds].forEach((id) => {
      const g = state.allGroups.find((x) => groupId(x) === id);
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = g ? groupDisplay(g) : id;
      els.tutorGroupSelect.appendChild(opt);
    });
    if ([...state.selectedGroupIds].includes(current)) els.tutorGroupSelect.value = current;
    else els.tutorGroupSelect.value = "";
  }

  function renderGroupChips() {
    els.groupChips.innerHTML = "";
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
        if (els.tutorGroupSelect.value === id) els.tutorGroupSelect.value = "";
        renderGroupChips();
        renderTutorOptions();
        renderGroupsUI();
      });
      chip.append(span, btn);
      els.groupChips.appendChild(chip);
    });
  }

  function toggleSelectGroupId(id) {
    if (state.selectedGroupIds.has(id)) state.selectedGroupIds.delete(id);
    else state.selectedGroupIds.add(id);
    if (!state.selectedGroupIds.has(els.tutorGroupSelect.value)) els.tutorGroupSelect.value = "";
    renderGroupChips();
    renderTutorOptions();
  }

  function renderTrackPills(stage, year) {
    els.trackPills.innerHTML = "";
    if (stage === "primaria") {
      els.trackPills.style.display = "none";
      return;
    }
    els.trackPills.style.display = "flex";

    tracks.forEach((track) => {
      const pill = document.createElement("div");
      pill.className = "trackPill";
      pill.textContent = track;

      const g = findGroupByStageYearTrack(stage, year, track);
      const id = g ? groupId(g) : null;
      if (id && state.selectedGroupIds.has(id)) pill.classList.add("isSelected");

      pill.addEventListener("click", async () => {
        pill.classList.add("isLoading");
        try {
          let grp = g || findGroupByStageYearTrack(stage, year, track);
          if (!grp) grp = await ensureGroup(stage, Number(year), track);

          const realId = grp ? groupId(grp) : null;
          if (!realId) {
            setError("No se pudo crear/encontrar el grupo.");
            return;
          }
          toggleSelectGroupId(realId);
          pill.classList.toggle("isSelected", state.selectedGroupIds.has(realId));
          setError("");
        } catch {
          setError("Error creando grupo. Revisa permisos/admin/backend.");
        } finally {
          pill.classList.remove("isLoading");
        }
      });

      els.trackPills.appendChild(pill);
    });
  }

  function renderPrimaryGrid(stage, year) {
    els.groupGrid.innerHTML = "";
    if (stage !== "primaria") {
      els.groupGrid.style.display = "none";
      return;
    }
    els.groupGrid.style.display = "grid";

    const filtered = state.allGroups.filter((g) => groupStageYearTrackMatch(g, "primaria", year, null));
    if (filtered.length === 0) {
      els.groupsHint.textContent = `No hay grupos creados para ${year}º Primaria.`;
      return;
    }

    filtered.forEach((g) => {
      const id = groupId(g);
      const label = groupDisplay(g);
      const btn = document.createElement("div");
      btn.className = `groupBtn${id && state.selectedGroupIds.has(id) ? " isSelected" : ""}`;
      btn.textContent = label;
      btn.addEventListener("click", () => {
        if (!id) return;
        toggleSelectGroupId(id);
        btn.classList.toggle("isSelected", state.selectedGroupIds.has(id));
      });
      els.groupGrid.appendChild(btn);
    });
  }

  function renderGroupsUI() {
    const stage = els.stageSelect.value;
    const year = els.yearSelect.value;

    els.groupsHint.textContent = stage === "primaria"
      ? `Selecciona grupos para ${year}º Primaria.`
      : `Selecciona grupos para ${year}º ${stageLabelFor(stage)}.`;

    renderTrackPills(stage, year);
    renderPrimaryGrid(stage, year);

    if (stage !== "primaria") {
      [...els.trackPills.children].forEach((pillEl) => {
        const track = pillEl.textContent.trim();
        const g = findGroupByStageYearTrack(stage, year, track);
        const id = g ? groupId(g) : null;
        pillEl.classList.toggle("isSelected", !!(id && state.selectedGroupIds.has(id)));
      });
    }
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

  els.stageSelect.addEventListener("change", () => {
    renderYearSelect();
    renderGroupsUI();
  });
  els.yearSelect.addEventListener("change", () => {
    renderGroupsUI();
  });

  loadGroups();

  return {
    loadGroups,
    renderGroupsUI,
    renderTutorOptions,
  };
}
