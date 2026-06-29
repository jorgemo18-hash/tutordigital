import { buildIcon } from "../../../../icons.js";

// Mismo estilo secundario para los dos botones de impresión — borde
// cobre, fondo transparente (.ac-btn.copper, ya existente en el panel).
function buildBotonImpresion(texto) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-btn copper sm";
  btn.append(buildIcon("download", { size: 13 }), document.createTextNode(` ${texto}`));
  return btn;
}

export function buildBotonDescargarPdf(onClick) {
  const btn = buildBotonImpresion("Descargar PDF");
  btn.addEventListener("click", onClick);
  return btn;
}

export function buildBotonDescargarTodos(onClick) {
  const btn = buildBotonImpresion("Descargar todos");
  btn.addEventListener("click", onClick);
  return btn;
}
