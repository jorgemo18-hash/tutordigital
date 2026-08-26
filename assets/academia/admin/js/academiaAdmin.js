import { requireSessionOrRedirect } from "../../../shared/js/guard.js";
import { logout } from "../../../shared/js/auth.js";
import { getTheme, saveTheme } from "../../../shared/js/header.js";
import { createFicharFab } from "../../../shared/js/fichaje/ficharFab.js";
import { fetchMe, fetchConfig } from "./api.js";
import { fichar, fetchMiEstadoFichaje } from "./apiFichajes.js";
import { buildSidebar, SECTIONS, SECTION_FICHAJES } from "./sidebar.js";
import { createAlumnosSection } from "./sections/alumnosSection.js";
import { createListaEsperaSection } from "./sections/listaEsperaSection.js";
import { renderDocumentosSection } from "./sections/documentosSection.js";
import { createFinanzasSection } from "./sections/finanzasSection.js";
import { createEnvioFamiliasSection } from "./sections/envioFamiliasSection.js";
import { createFichajesSection } from "./sections/fichajesSection.js";
import { createProfesoresSection } from "./sections/profesoresSection.js";
import { createSustitucionesSection } from "./sections/sustitucionesSection.js";
import { renderAjustesSection } from "./sections/ajustesSection.js";
import { aplicarFondoGlobal } from "./sections/ajustes/personalizacionDom.js";
import { createHorarioSection } from "./sections/horarioSection.js";

function temaClase(theme) {
  return theme === "light" ? "ac-claro" : "ac-oscuro";
}

function buildLayout(root) {
  root.innerHTML = "";
  const app = document.createElement("div");
  app.className = `ac-app bg-frame ${temaClase(getTheme())}`;
  root.appendChild(app);

  // Mismo patrón que assets/academia/profesor/js/academiaProfesor.js: foto +
  // velo fijos detrás del sidebar/main. La pila de fondo (bg-photo/bg-veil)
  // es la compartida de assets/shared/styles/components/bg-layers.css —
  // .ac-photo/.ac-veil solo quedan para la imagen concreta y el hook de
  // personalización (aplicarFondoGlobal) y de impresión (_fiscal-print.css).
  const photo = document.createElement("div");
  photo.className = "ac-photo bg-photo";
  const veil = document.createElement("div");
  veil.className = "ac-veil bg-veil";
  app.append(photo, veil);

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

  const config = await fetchConfig().catch(() => null);
  aplicarFondoGlobal(config?.bg_url);

  // FAB persistente en document.body (fuera de .ac-app): igual en
  // cualquier sección y en cualquier viewport (ver ficharFab.js). Solo
  // se monta si el tenant activó el control horario; sin eso, ni
  // siquiera se crea (nada que fichar).
  if (config?.control_horario_activo) {
    const ficharFab = createFicharFab({ ficharFnDep: fichar, fetchMiEstadoFichajeFn: fetchMiEstadoFichaje });
    document.body.appendChild(ficharFab.el);
  }

  // Alumnos y Finanzas montan un drawer propio que vive en document.body —
  // se crean una sola vez (factoría) y se reutilizan en cada visita a la
  // sección, en vez de volver a montarlos y apilar overlays.
  const alumnosSection = createAlumnosSection({ config: config || {} });
  const finanzasSection = createFinanzasSection();
  const envioFamiliasSection = createEnvioFamiliasSection({ config: config || {}, tenantNombre: me.tenantName });
  const fichajesSection = createFichajesSection();
  const profesoresSection = createProfesoresSection();
  const sustitucionesSection = createSustitucionesSection();
  const listaEsperaSection = createListaEsperaSection();
  const horarioSection = createHorarioSection({ config: config || {} });

  const SECTION_RENDERERS = {
    alumnos: () => alumnosSection.render(mainShell),
    horario: () => horarioSection.render(mainShell),
    lista_espera: () => listaEsperaSection.render(mainShell),
    documentos: () => renderDocumentosSection(mainShell, { tenantNombre: me.tenantName }),
    finanzas: () => finanzasSection.render(mainShell),
    envio_familias: () => envioFamiliasSection.render(mainShell),
    fichajes: () => fichajesSection.render(mainShell),
    profesores: () => profesoresSection.render(mainShell),
    sustituciones: () => sustitucionesSection.render(mainShell),
    // `config` es el mismo objeto que ya tienen alumnosSection/envioFamiliasSection
    // (factorías creadas una sola vez arriba) — al subir logo/fondo en
    // Ajustes se muta en sitio para que cualquier sección que lo lea
    // después (p.ej. el logo del recibo en Envío a familias) vea la URL
    // nueva sin recargar la página.
    ajustes: () =>
      renderAjustesSection(mainShell, {
        onLogoActualizado: (url) => { if (config) config.logo_url = url; },
        onBgActualizado: (url) => { if (config) config.bg_url = url; },
      }),
  };

  let activeId = "alumnos";
  function selectSection(sectionId) {
    activeId = sectionId;
    sidebar.setActive(sectionId);
    SECTION_RENDERERS[sectionId]?.();
  }

  const sections = config?.control_horario_activo ? [...SECTIONS, SECTION_FICHAJES] : SECTIONS;

  const sidebar = buildSidebar({
    activeId,
    sections,
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
