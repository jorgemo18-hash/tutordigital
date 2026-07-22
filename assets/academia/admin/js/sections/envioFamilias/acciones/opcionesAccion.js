// Listas de opciones para el diálogo de "Regenerar"/"Enviar" (ver
// elegirAccionDialog.js) en los dos niveles del panel: mes completo
// (cabecera) y familia seleccionada. Funciones puras — sin red ni DOM —
// para poder testear la composición de opciones sin mocks.

// Nivel mes: siempre las mismas 3 opciones, "recibos e informes" es la de
// por defecto (primera de la lista).
export function opcionesLote(verbo) {
  return [
    { tipo: "completo", label: `${verbo} recibos e informes` },
    { tipo: "solo_recibo", label: "Solo recibos" },
    { tipo: "solo_informe", label: "Solo informes" },
  ];
}

// Nivel familia: "completo"/"solo_recibo" siempre presentes, más una
// opción por cada alumno activo ("[Verbo] informe de [nombre]"). "Solo
// informes" (todos los alumnos a la vez) solo se ofrece con 2+ alumnos
// activos — con exactamente 1, sería un duplicado exacto de su única
// opción "por alumno", así que se omite y se deja solo esa (la etiqueta
// con el nombre es más clara que la genérica). Con 0 alumnos activos no
// hay ninguna opción de informe.
export function opcionesFamilia(verbo, alumnosActivos) {
  const opciones = [
    { tipo: "completo", label: `${verbo} recibo e informes` },
    { tipo: "solo_recibo", label: "Solo recibo" },
  ];
  if (alumnosActivos.length >= 2) {
    opciones.push({ tipo: "solo_informe", label: "Solo informes" });
  }
  for (const alumno of alumnosActivos) {
    opciones.push({
      tipo: "informe_alumno",
      alumnoId: alumno.id,
      alumnoNombre: alumno.nombre,
      label: `${verbo} informe de ${alumno.nombre}`,
    });
  }
  return opciones;
}
