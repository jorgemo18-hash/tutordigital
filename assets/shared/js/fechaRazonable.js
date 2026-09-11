// ¿Esta fecha es una fecha de academia o un dedazo?
//
// EL CASO REAL (encontrado en producción el 11/09/2026). Un alumno de Lyceo
// tenía `fecha_alta = 1013-11-05`. Año mil trece. Se teclea sin querer en un
// `<input type="date">` —el año son cuatro dígitos sueltos y no hay nada que
// avise— y desde ahí se propagó a TRES tablas, porque el alta usa la
// fecha_alta como día de inicio del horario y de la tarifa: 1 fila en
// academia_alumnos, 5 en academia_horario y 1 en academia_tarifas.
//
// POR QUÉ IMPORTA Y NO ES SOLO FEO. La fecha de inicio del horario decide si
// el alumno sale en el Diario (`fecha_inicio <= fecha`). Un año pasado
// disparatado no se nota —sale igual—, pero el mismo dedazo hacia delante
// ("3026") esconde al alumno del Diario para siempre y sin explicación: el
// cuadrante lo enseña, el parte del día no, y no hay ningún sitio donde se
// vea por qué.
//
// LA VENTANA ES RELATIVA A HOY, no dos años escritos a mano que envejecen.
// Hacia atrás, ancha: el histórico de un alumno que lleva años viniendo es
// legítimo. Hacia delante, corta: "empieza el" a más de cinco años vista no
// es una matrícula, es un dedazo.
//
// NO SUSTITUYE A NINGUNA REGLA DE NEGOCIO. No sabe si la academia existía en
// 2010 ni si el curso empieza en septiembre. Solo descarta lo imposible, que
// es justo lo que un campo de fecha no sabe hacer solo.

export const ANIOS_ATRAS = 20;
export const ANIOS_ADELANTE = 5;

function desplazarAnios(hoyISO, anios) {
  const [anio, resto] = [Number(String(hoyISO).slice(0, 4)), String(hoyISO).slice(4, 10)];
  return `${anio + anios}${resto}`;
}

// Los límites para `min`/`max` de un input date, en YMD.
export function rangoFechaRazonable(hoyISO = new Date().toISOString().slice(0, 10)) {
  return {
    min: desplazarAnios(hoyISO, -ANIOS_ATRAS),
    max: desplazarAnios(hoyISO, ANIOS_ADELANTE),
  };
}

// Comparación de CADENAS YMD, nunca `Date`: construir un Date en el
// navegador arrastra la zona horaria y el 1 de octubre a medianoche pasa a
// ser el 30 de septiembre. Mismo criterio que aniosArchivo.js y
// buildBadgeDesde.
//
// Una fecha vacía NO es irrazonable: "no hay dato" es un estado legítimo en
// varios campos, y quien lo exija ya lo exige por su cuenta.
export function fechaRazonable(valor, hoyISO = new Date().toISOString().slice(0, 10)) {
  const fecha = String(valor || "").slice(0, 10);
  if (!fecha) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const { min, max } = rangoFechaRazonable(hoyISO);
  return fecha >= min && fecha <= max;
}

// El aviso, con el año que se ha colado dentro. Sin decir el año, "revisa la
// fecha" no ayuda: lo que pasa es que hay un 1013 donde debería haber un
// 2026, y el campo lo enseña en formato español, donde el año va al final y
// se lee peor.
export function motivoFechaIrrazonable(valor, hoyISO = new Date().toISOString().slice(0, 10)) {
  if (fechaRazonable(valor, hoyISO)) return "";
  const fecha = String(valor || "").slice(0, 10);
  const anio = fecha.slice(0, 4);
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ? `El año ${anio} no puede ser: revisa la fecha.`
    : "Esa fecha no es válida.";
}
