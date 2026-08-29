import { tramosDe } from "../../../../../shared/js/horarioTramos.js";

// Copia de cliente de las funciones puras de
// server/lib/academiaHorario/ocupacion.js. El navegador no puede importar
// desde server/, y duplicar tres líneas es preferible a montar un paso de
// compilación o a mover lógica de dominio a assets/ solo por el import.
//
// Si alguna de las dos cambia, la otra tiene que cambiar igual: lo fija el
// test tests/academiaHorario/ocupacion.test.mjs, que importa AMBAS y
// comprueba que dan el mismo resultado.
export function claveFranja(diaSemana, horaInicio) {
  return `${Number(diaSemana)}|${String(horaInicio || "").slice(0, 5)}`;
}

export function contarOcupacion(franjas, { excluirAlumnoId = null } = {}) {
  const porFranja = new Map();
  // Array.isArray y no un valor por defecto: `= []` solo cubre undefined, y
  // una respuesta de API puede llegar como null perfectamente.
  if (!Array.isArray(franjas)) return porFranja;
  for (const f of franjas) {
    const alumnoId = f?.alumno?.id ?? f?.alumno_id ?? null;
    if (excluirAlumnoId && alumnoId === excluirAlumnoId) continue;
    // POR TRAMO CUBIERTO, no por hora de inicio. Desde que una clase puede
    // durar lo que sea (ver horarioTramos.js), contar por hora de inicio
    // hace invisibles a los alumnos que se solapan a medias: quien viene de
    // 16:00 a 17:00 y quien viene de 16:30 a 17:30 comparten aula media
    // hora y el aviso de "franja llena" no los vería.
    for (const tramo of tramosDe(f?.hora_inicio, f?.hora_fin)) {
      const clave = claveFranja(f?.dia_semana, tramo);
      porFranja.set(clave, (porFranja.get(clave) || 0) + 1);
    }
  }
  return porFranja;
}

export function alumnosSinHorario(alumnos, franjas) {
  const listaAlumnos = Array.isArray(alumnos) ? alumnos : [];
  const conFranja = new Set(
    (Array.isArray(franjas) ? franjas : [])
      .map((f) => f?.alumno?.id ?? f?.alumno_id)
      .filter(Boolean)
  );
  return listaAlumnos.filter((a) => a?.activo !== false && !conFranja.has(a.id));
}

// Estado de una franja frente al máximo de plazas del centro
// (academia_config.max_alumnos_por_franja, migración 106).
//
// `maximo` null/0 = el centro no ha fijado plazas: la franja nunca está
// "llena" porque nadie ha dicho cuántas caben. Se sigue informando de la
// ocupación, solo que sin comparar.
//
// "excedido" existe además de "lleno" porque superar el máximo es posible a
// propósito: el límite avisa y no bloquea, así que hay que poder pintar el
// caso de "aquí ya hay uno de más" en vez de fingir que no pasa.
export function estadoFranja(ocupados, maximo) {
  const n = Number(ocupados) || 0;
  const max = Number(maximo) || 0;
  if (max <= 0) return n > 0 ? "ocupada" : "libre";
  if (n > max) return "excedido";
  if (n >= max) return "lleno";
  return n > 0 ? "ocupada" : "libre";
}
