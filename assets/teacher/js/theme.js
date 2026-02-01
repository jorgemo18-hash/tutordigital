export function getSystemTheme() {
  try {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "dark";
  }
}

export function getSavedTheme() {
  try {
    const t = localStorage.getItem("ttdTheme");
    return (t === "dark" || t === "light") ? t : "";
  } catch {
    return "";
  }
}

export function applyTheme(theme) {
  const t = (theme === "dark" || theme === "light") ? theme : (getSystemTheme() || "dark");
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("ttdTheme", t); } catch {}
}

export function updateThemeToggleLabel(btn) {
  if (!btn) return;
  const current = document.documentElement.dataset.theme || getSystemTheme() || "dark";
  btn.textContent = current === "dark" ? "Claro" : "Oscuro";
}
