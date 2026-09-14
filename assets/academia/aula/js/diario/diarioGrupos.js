// Agrupa las entradas del diario por hora de clase.
//
// PARA QUÉ. En una tarde con cinco alumnos a las 17:30 la lista es un muro
// de tarjetas donde la misma hora se repite cinco veces y no se ve dónde
// acaba una hora y empieza la siguiente. Con una raya entre grupos, el
// diario se lee por tramos —que es como se da clase— en vez de como una
// lista corrida.
//
// Se agrupan entradas CONSECUTIVAS, no se reordena nada: la lista llega ya
// ordenada por hora del backend (ver academia.sesiones.routes.js, que
// ordena por hora_inicio y deja al final los alumnos sin horario). Reordenar
// aquí sería una segunda fuente de verdad sobre el orden del diario, y en
// cuanto las dos discreparan nadie sabría cuál manda.
//
// `horaDe` se recibe como parámetro en vez de importarlo: quien pinta las
// tarjetas ya decide cómo se lee la hora de una entrada (incluido el caso
// "Extra", el alumno sin horario fijo), y aquí no hace falta saberlo.

export function agruparPorHora(lista = [], horaDe = () => "") {
  const grupos = [];
  for (const entrada of lista) {
    const hora = horaDe(entrada);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.hora === hora) ultimo.entradas.push(entrada);
    else grupos.push({ hora, entradas: [entrada] });
  }
  return grupos;
}
