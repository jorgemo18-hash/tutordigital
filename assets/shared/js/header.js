function getThemeKey() {
  try {
    const slug = localStorage.getItem("ttd_activeTenantSlug") || "";
    return slug ? `ttdTheme_${slug}` : "ttdTheme";
  } catch { return "ttdTheme"; }
}

export function getTheme() {
  // Always read the actually-applied theme first — avoids key-mismatch with init scripts.
  const current = document.documentElement.dataset.theme;
  if (current === "dark" || current === "light") return current;
  try {
    const saved = localStorage.getItem(getThemeKey());
    if (saved === "dark" || saved === "light") return saved;
  } catch {}
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {}
  return "dark";
}

export function saveTheme(theme) {
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
    const themeBtn = document.createElement("button");
    themeBtn.type = "button";
    themeBtn.setAttribute("aria-label", "Cambiar tema");
    themeBtn.className = (btnClass ? btnClass + " " : "") + "themeToggleBtn";
    themeBtn.innerHTML = [
      '<svg class="themeIconMoon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
      '<svg class="themeIconSun"  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    ].join("");
    themeBtn.addEventListener("click", () => {
      saveTheme(getTheme() === "dark" ? "light" : "dark");
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
