import { requireSessionOrRedirect } from "../../../shared/js/guard.js";
import { logout } from "../../../shared/js/auth.js";
import { getTheme, saveTheme } from "../../../shared/js/header.js";
import { fetchMe, fetchConfig, fetchFamilias } from "./api.js";
import { buildSidebar } from "./sidebar.js";
import { createAlumnosSection } from "./sections/alumnosSection.js";
import { renderListaEsperaSection } from "./sections/listaEsperaSection.js";
import { renderDocumentosSection } from "./sections/documentosSection.js";
import { createFinanzasSection } from "./sections/finanzasSection.js";
import { renderAjustesSection } from "./sections/ajustesSection.js";

function temaClase(theme) {
  return theme === "light" ? "ac-claro" : "ac-oscuro";
}

function buildLayout(root) {
  root.innerHTML = "";
  const app = document.createElement("div");
  app.className = `ac-app ${temaClase(getTheme())}`;
  root.appendChild(app);

  const main = document.createElement("div");
  main.className = "ac-main";
  const mainShell = document.createElement("div");
  mainShell.className = "ac-main-shell";
  main.appendChild(mainShell);

  return { app, main, mainShell };
}

async function init() {
  requireSessionOrRedirect({ requireTenant: true });

  const root = document.getElementById("academiaAdminApp");
  const { app, main, mainShell } = buildLayout(root);

  let me = { displayName: "", role: "", tenantName: "" };
  try {
    me = await fetchMe();
  } catch {
    // si falla, seguimos con cabecera vacía en vez de bloquear el panel
  }
  if (me.role && me.role !== "admin") {
    window.location.href = "/login";
    return;
  }

  const [config, familias] = await Promise.all([
    fetchConfig().catch(() => null),
    fetchFamilias().catch(() => []),
  ]);

  // Alumnos y Finanzas montan un drawer propio que vive en document.body —
  // se crean una sola vez (factoría) y se reutilizan en cada visita a la
  // sección, en vez de volver a montarlos y apilar overlays.
  const alumnosSection = createAlumnosSection({ familias, config: config || {} });
  const finanzasSection = createFinanzasSection();

  const SECTION_RENDERERS = {
    alumnos: () => alumnosSection.render(mainShell),
    lista_espera: () => renderListaEsperaSection(mainShell),
    documentos: () => renderDocumentosSection(mainShell),
    finanzas: () => finanzasSection.render(mainShell),
    ajustes: () => renderAjustesSection(mainShell),
  };

  let activeId = "alumnos";
  function selectSection(sectionId) {
    activeId = sectionId;
    sidebar.setActive(sectionId);
    SECTION_RENDERERS[sectionId]?.();
  }

  const sidebar = buildSidebar({
    activeId,
    onSelect: selectSection,
    onThemeToggle: () => {
      const next = getTheme() === "light" ? "dark" : "light";
      saveTheme(next);
      app.className = `ac-app ${temaClase(next)}`;
      sidebar.setThemeLabel(next);
    },
    onLogout: async () => {
      await logout();
      window.location.href = "/login";
    },
    user: { displayName: me.displayName || "Admin", tenantName: me.tenantName || "Academia" },
  });
  sidebar.setThemeLabel(getTheme());

  app.append(sidebar.wrap, main);
  selectSection(activeId);
}

init();
