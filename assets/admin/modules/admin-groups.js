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
  } = opts;

  const creatingGroupKeys = new Set();
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
    const stage = stageSelect.value;
    const years = stageYears(stage);
    yearSelect.innerHTML = "";
    years.forEach((y) => {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = `${y}º`;
      yearSelect.appendChild(opt);
    });
    yearSelect.selectedIndex = 0;
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
  }

  function toggleSelectGroupId(id) {
    if (state.selectedGroupIds.has(id)) state.selectedGroupIds.delete(id);
    else state.selectedGroupIds.add(id);
    if (!state.selectedGroupIds.has(tutorGroupSelect.value)) tutorGroupSelect.value = "";
    renderGroupChips();
    renderTutorOptions();
  }

  function renderTrackPills(stage, year) {
    trackPills.innerHTML = "";
    if (stage === "primaria") {
      trackPills.style.display = "none";
      return;
    }
    trackPills.style.display = "flex";

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

      trackPills.appendChild(pill);
    });
  }

  function showTrackSelectIfNeeded() {
    const isPrimaria = stageSelect.value === "primaria";
    if (trackSelect) {
      trackSelect.classList.toggle("hidden", !isPrimaria);
      trackSelect.value = "";
    }
    if (trackPills) trackPills.classList.toggle("hidden", isPrimaria);
    if (groupGrid) {
      groupGrid.classList.add("hidden");
      groupGrid.innerHTML = "";
    }
  }

  function renderGroupsUI() {
    const stage = stageSelect.value;
    const year = yearSelect.value;

    showTrackSelectIfNeeded();

    groupsHint.textContent = stage === "primaria"
      ? `Selecciona grupos para ${year}º Primaria.`
      : `Selecciona grupos para ${year}º ${stageLabelFor(stage)}.`;

    if (stage === "primaria") {
      groupsHint.textContent = `Añade grupos para ${year}º Primaria (A–E). Se acumulan abajo.`;
      renderGroupChips();
      renderTutorOptions();
      return;
    }

    renderTrackPills(stage, year);

    if (stage !== "primaria") {
      [...trackPills.children].forEach((pillEl) => {
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

  if (trackSelect) {
    trackSelect.addEventListener("change", async () => {
      const track = String(trackSelect.value || "").trim();
      if (!track) return;

      // reset inmediato para selección múltiple fluida
      trackSelect.value = "";

      const stage = stageSelect.value;
      if (stage !== "primaria") return;
      const year = yearSelect.value;
      if (!stage || !year) return;
      try {
        let grp = findGroupByStageYearTrack(stage, year, track);
        if (!grp) grp = await ensureGroup(stage, Number(year), track);
        const realId = grp ? groupId(grp) : null;
        if (!realId) {
          setError("No se pudo crear/encontrar el grupo.");
          return;
        }
        state.selectedGroupIds.add(realId);
        renderGroupChips();
        renderTutorOptions();
        setError("");
      } catch (err) {
        const status = err?.status || err?.response?.status;
        if (status === 403) setError("No tienes permisos admin en backend para autocrear grupos.");
        else if (status === 404) setError("Tu backend no tiene /admin/groups/ensure desplegado (404). Despliega Render.");
        else setError("Error al crear/seleccionar grupo. Revisa backend/logs.");
      }
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
