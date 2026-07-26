// Aviso compartido por Horario y Diario: si el profesor cubre a alguien
// HOY, los alumnos de esa persona aparecen en ambas vistas sin estar
// asignados directamente — sin este aviso no habría forma de saber por
// qué. Sustituciones pasa a ser gestión exclusiva del admin (el
// profesor ya no declara/revoca nada, ver commit de este cambio), así
// que aquí no hace falta ninguna pestaña propia, solo esta nota de
// contexto en los dos sitios donde el efecto es real.
//
// Solo cuenta "soy_sustituto": que a este profesor le cubra otro no
// cambia nada de lo que ÉL ve, así que no se avisa de eso aquí.
export function buildAvisoSustituciones(sustituciones) {
  const cubiertos = (sustituciones || []).filter((s) => s.soy_sustituto);
  if (!cubiertos.length) return null;

  const nombres = cubiertos.map((s) => s.sustituido_nombre || "un profesor");
  const el = document.createElement("div");
  el.className = "ac-nota";
  el.textContent = `Hoy cubres a ${nombres.join(", ")} — sus alumnos aparecen aquí.`;
  return el;
}
