// Escape canónico de HTML del proyecto — usar siempre antes de interpolar
// datos de BD/usuario en innerHTML. No usar textContent/DOM APIs no evita
// esto: sigue haciendo falta en cualquier sitio que construya HTML como
// texto (plantillas de cadena) en vez de crear nodos.
export function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
