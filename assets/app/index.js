// assets/app/controllers/math.js
export function looksMath(text) {
  if (STATE?.fromDictation) return false;

  // Si el pad matemático está abierto, forzamos preview KaTeX.
  // Esto hace que al usar el teclado de mates siempre haya preview,
  // aunque `looksMath` sea conservador para frases normales.
  try {
    const __pad = document.getElementById("pad");
    if (__pad && __pad.classList.contains("show")) return true;
  } catch {}

  // ...rest of the looksMath function code
}