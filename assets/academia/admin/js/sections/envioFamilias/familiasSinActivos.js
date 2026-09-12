// LAS FAMILIAS QUE NO PUEDEN RECIBIR NADA ESTE MES, fuera de la lista.
//
// EL PROBLEMA (Jorge, 12/09/2026): *"en envío a familias no tiene sentido que
// salgan los alumnos que no están activos, no?"*. No tiene sentido, no.
//
// LOS NÚMEROS DE LYCEO el día que lo dijo: de las **41 familias activas** de
// la lista, **17 no pueden recibir nada** — 9 solo tienen alumnos archivados,
// 7 solo borradores y 1 no tiene ningún alumno vinculado. Es el 41 % de la
// pantalla ocupando sitio sin ser accionable, y con un texto que encima
// engaña: "Sin recibo ni informe este mes" se lee como trabajo pendiente
// cuando lo que pasa es que **no se les puede generar nada**.
//
// EL LOTE YA LAS SALTA. `generarParaFamiliasSinRecibo` hace
// `if (!alumnosActivos.length) continue;`, así que esas familias no reciben
// recibo ni lo recibirán nunca mientras sigan así. La lista era el único
// sitio donde parecían estar esperando algo.
//
// EL CRITERIO ES `alumnos_activos.length`, NO el estado "vacío" de
// estadoFamilia.js. Se parecen y no son lo mismo: una familia CON alumnos
// activos a la que se le olvidó generar el recibo también sale como "vacío",
// y esa sí es accionable — es justo el caso que el aviso de "Por emitir" de
// Finanzas saca a la luz. Si se filtrara por el estado, se esconderían las
// familias sin facturar, que es lo contrario de lo que hace falta.
//
// NO DESAPARECEN EN SILENCIO: van a un desplegable al pie con sus nombres.
// Una familia que se esconde sin decir dónde está es la forma de que alguien
// piense que se ha borrado.

// Una familia es accionable este mes si tiene al menos un alumno activo.
// `alumnos_activos` lo calcula el backend (fetchFamiliasConAlumnos), que es
// la misma consulta que alimenta al lote.
export function separarPorAlumnosActivos(items = []) {
  const conActivos = [];
  const sinActivos = [];
  for (const item of items || []) {
    ((item?.alumnos_activos || []).length ? conActivos : sinActivos).push(item);
  }
  return { conActivos, sinActivos };
}

export function textoSinActivos(sinActivos = []) {
  const n = sinActivos.length;
  if (!n) return "";
  return n === 1
    ? "1 familia sin alumnos activos: no se le genera nada este mes"
    : `${n} familias sin alumnos activos: no se les genera nada este mes`;
}

// El pie de la lista. `<details>` y no un bloque siempre abierto: cerrado
// ocupa una línea y contesta "¿dónde está el resto?"; abierto dice quiénes
// son. Devuelve null si no hay ninguna, que es lo que pasará en un centro
// que no arrastre histórico.
export function buildPieSinActivos(sinActivos = []) {
  if (!sinActivos.length) return null;

  const det = document.createElement("details");
  det.className = "ef-sin-activos";

  const sum = document.createElement("summary");
  sum.className = "ef-sin-activos-sum";
  sum.textContent = textoSinActivos(sinActivos);
  det.appendChild(sum);

  const lista = document.createElement("div");
  lista.className = "ef-sin-activos-lista";
  // Por nombre: es como se las busca. El backend ya las devuelve ordenadas
  // (`order("nombre")` en fetchFamiliasConAlumnos), así que no se reordena
  // aquí — se conserva el orden en el que vienen.
  for (const item of sinActivos) {
    const fila = document.createElement("div");
    fila.className = "ef-sin-activos-fila";
    fila.textContent = item.familia_nombre || "(sin nombre)";
    lista.appendChild(fila);
  }
  det.appendChild(lista);
  return det;
}
