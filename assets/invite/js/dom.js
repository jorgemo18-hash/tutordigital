// Helpers de UI puros — sin estado propio, sin dependencias de negocio.
// Extraído literal de invite.html (antes inline en el <script type="module">).

export function el(id) {
  return document.getElementById(id);
}

export function showMessage(id, text, isSuccess = false) {
  const node = el(id);
  if (!node) return;
  node.textContent = text || "";
  node.className = `msg ${isSuccess ? "ok" : (text ? "err" : "")}`;
}

export function showResult(icon, title, text) {
  el("authBox").classList.add("hidden");
  el("resultBox").classList.remove("hidden");
  if (el("resultIcon")) el("resultIcon").textContent = icon;
  if (el("resultTitle")) el("resultTitle").textContent = title;
  if (el("resultText")) el("resultText").textContent = text;
}

export function showRedirectBar() {
  const bar = el("redirectBar");
  if (bar) bar.classList.remove("hidden");
}
