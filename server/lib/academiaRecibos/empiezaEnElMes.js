// ¿SE LE COBRA ESTE MES A ESTE ALUMNO? Cálculo puro.
//
// EL PROBLEMA (Jorge, 30/09/2026): *"si Hugo empieza el 1 de octubre pero
// ya lo tengo apuntado, en septiembre no lo voy a cobrar"*. Hasta ahora
// cualquier alumno activo entraba en el recibo del mes y en "Por emitir",
// empezara cuando empezara.
//
// CUÁNDO EMPIEZA: lo dice su HORARIO (academia_horario.fecha_inicio), no su
// fecha_alta. La fecha_alta es histórica a propósito —un alumno que vuelve
// conserva la del curso pasado, y de ella dependen los descuentos por
// intervalo (ver academiaAlumnoSchemas.js, 11/09/2026)—; lo que cambia
// cuando vuelve es su horario.
//
// LA REGLA: se le cobra el mes si empieza ese mes o antes.
//   - Cuentan las franjas de horario que siguen vivas al empezar el mes
//     (sin fecha_fin, o que acaban dentro del mes o después): un horario del
//     curso pasado ya cerrado no dice cuándo vuelve.
//   - Si todas sus franjas están cerradas, NO se le quita: esta regla solo
//     decide cuándo EMPIEZA a cobrarse. Cuándo se deja de cobrar lo decide
//     la baja (activo = false), como hasta ahora.
//   - Sin horario ninguno, manda la fecha_alta (un alta con fecha futura
//     tampoco se cobra); sin fecha_alta, se cobra, como siempre.
//
// Las fechas son "AAAA-MM-DD" y se comparan como texto: es el formato de
// las columnas date de Postgres y ordena igual que las fechas.
export function limitesDelMes(mes, anio) {
  const mm = String(mes).padStart(2, "0");
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return { desde: `${anio}-${mm}-01`, hasta: `${anio}-${mm}-${String(ultimo).padStart(2, "0")}` };
}

export function empiezaEnElMesOAntes({ fechaAlta = null, horarios = [] } = {}, { mes, anio }) {
  const { desde, hasta } = limitesDelMes(mes, anio);
  const vivas = horarios.filter((h) => h.fecha_inicio && (!h.fecha_fin || h.fecha_fin >= desde));
  if (vivas.length) return vivas.some((h) => h.fecha_inicio <= hasta);
  if (horarios.length) return true;
  return !fechaAlta || String(fechaAlta).slice(0, 10) <= hasta;
}
