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

// QUÉ RECIBOS SE REHACEN (Jorge, 24/09/2026, después de perder las marcas de
// pago de septiembre con un "Regenerar"): *"que cuando des te diga todos o
// solo los que no están creados o no tocar los que ya estén enviados"*.
// La primera, la que no toca nada, es la de por defecto. Cada opción dice
// con números QUÉ va a pasar, que es lo que le faltaba al aviso de antes.
// `resumen`: { sinRecibo, borradores, enviados, pagados } del mes.
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export function opcionesRegenerarRecibos({ sinRecibo = 0, borradores = 0, enviados = 0, pagados = 0 } = {}) {
  const yaHechos = enviados + pagados;
  return [
    {
      modo: "faltan",
      label: "Crear solo los que faltan",
      detalle: sinRecibo
        ? `${plural(sinRecibo, "familia sin recibo", "familias sin recibo")}. No toca ninguno de los que ya hay.`
        : "Ahora mismo no falta ninguno. No toca los que ya hay.",
    },
    {
      modo: "borradores",
      label: "Rehacer los que no se han enviado",
      detalle: (borradores ? `Rehace ${plural(borradores, "borrador", "borradores")} y crea los que faltan.` : "No hay borradores que rehacer: solo crea los que faltan.")
        + (yaHechos ? ` Los ${yaHechos} enviados o pagados no se tocan.` : ""),
    },
    {
      modo: "todos",
      label: "Rehacer todos, también los enviados",
      detalle: [
        enviados ? `${plural(enviados, "enviado vuelve", "enviados vuelven")} a «Sin enviar» y habrá que reenviarlos.` : "",
        pagados ? `${plural(pagados, "pagado sigue marcado como pagado", "pagados siguen marcados como pagados")}.` : "",
      ].filter(Boolean).join(" ") || "Rehace todos los recibos del mes.",
      peligro: true,
    },
  ];
}
