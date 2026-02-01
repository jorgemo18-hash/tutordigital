export function getSystemTheme() {
  try {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "dark";
  }
}

function getThemeKey(tenantId) {
  return tenantId ? `ttdTheme_${tenantId}` : "ttdTheme";
}

export function getSavedTheme(tenantId) {
  try {
    const t = localStorage.getItem(getThemeKey(tenantId));
    return (t === "dark" || t === "light") ? t : "";
  } catch {
    return "";
  }
}

export function applyTheme(theme, tenantId) {
  const t = (theme === "dark" || theme === "light") ? theme : (getSystemTheme() || "dark");
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(getThemeKey(tenantId), t); } catch {}
}

export function updateThemeToggleLabel(btn) {
  if (!btn) return;
  const current = document.documentElement.dataset.theme || getSystemTheme() || "dark";
  btn.textContent = current === "dark" ? "Claro" : "Oscuro";
}
