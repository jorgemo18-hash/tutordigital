// Nota discreta (aviso legal de Fiscal) — a diferencia de .ac-banner.amber
// (alerta llamativa, colores ámbar propios), usa los tokens reales del
// sistema (--panel-bg, --copper, --ink-soft) para que sea un comentario
// de fondo, no una alerta.
export function buildNotaDiscreta(texto) {
  const nota = document.createElement("div");
  nota.className = "ac-nota";
  nota.textContent = texto;
  return nota;
}
