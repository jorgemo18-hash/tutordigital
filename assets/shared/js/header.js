function getThemeKey() {
  try {
    const slug = localStorage.getItem("ttd_activeTenantSlug") || "";
    return slug ? `ttdTheme_${slug}` : "ttdTheme";
  } catch { return "ttdTheme"; }
}

function getTheme() {
  try {
    const saved = localStorage.getItem(getThemeKey());
    if (saved === "dark" || saved === "light") return saved;
  } catch {}
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {}
  return "dark";
}

function saveTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(getThemeKey(), theme); } catch {}
}

/**
 * Populates `container` with a theme toggle and a logout button.
 * Replaces any existing contents.
 *
 * @param {HTMLElement|null} container  Element to render into
 * @param {{ role: string, btnClass?: string, onLogout: () => void }} opts
 *   role      – current view role (kept for API compatibility, not rendered)
 *   btnClass  – CSS class applied to every button (optional)
 *   onLogout  – callback fired when "Cerrar sesión" is clicked
 */
export function buildHeader(container, { role, btnClass = "", onLogout, skipTheme = false }) {
  if (!container) return;
  container.innerHTML = "";

  if (!skipTheme) {
    // Theme toggle
    const themeBtn = document.createElement("button");
    themeBtn.type = "button";
    if (btnClass) themeBtn.className = btnClass;
    const refreshLabel = () => {
      themeBtn.textContent = getTheme() === "dark" ? "Claro" : "Oscuro";
    };
    refreshLabel();
    themeBtn.addEventListener("click", () => {
      saveTheme(getTheme() === "dark" ? "light" : "dark");
      refreshLabel();
    });
    container.appendChild(themeBtn);
  }

  // Logout
  const logoutBtn = document.createElement("button");
  logoutBtn.type = "button";
  if (btnClass) logoutBtn.className = btnClass;
  logoutBtn.textContent = "Cerrar sesión";
  logoutBtn.addEventListener("click", onLogout);
  container.appendChild(logoutBtn);
}
