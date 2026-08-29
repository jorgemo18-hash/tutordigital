const NOMBRES_DIA = {
  1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves",
  5: "Viernes", 6: "Sábado", 7: "Domingo",
};

// "Martes 16:00–17:30 · Jueves 18:00–19:00" — lo que se va a guardar, escrito
// en cristiano debajo de la rejilla.
//
// No es decoración: desde que una clase se forma juntando casillas de media
// hora, mirar la rejilla ya no basta para saber qué ha salido. Tres casillas
// seguidas y tres sueltas se parecen mucho a simple vista y son cosas muy
// distintas (una clase de hora y media frente a tres clases de media hora).
export function textoFranjas(franjas = []) {
  if (!franjas.length) return "Sin horario asignado todavía.";
  return franjas
    .slice()
    .sort((a, b) => (a.dia_semana - b.dia_semana) || String(a.hora_inicio).localeCompare(String(b.hora_inicio)))
    .map((f) => `${NOMBRES_DIA[f.dia_semana] || `Día ${f.dia_semana}`} ${f.hora_inicio}–${f.hora_fin}`)
    .join(" · ");
}

export function buildResumenFranjas(franjas = []) {
  const el = document.createElement("div");
  el.className = "ac-foot-hint";
  el.style.marginTop = "8px";
  el.textContent = textoFranjas(franjas);
  return el;
}
