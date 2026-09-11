// Los chips de año de la pestaña "Archivados".
//
// POR QUÉ. Archivados es la única pestaña que solo crece: cada curso deja
// ahí a los que se fueron y nunca se vacía. Hoy son 10 y da igual; a cinco
// cursos vista son cientos, paginados de 30 en 30, y el dato con el que uno
// los recuerda es el año en que se fueron.
//
// SE ESCONDE SOLO CUANDO NO SIRVE. Con un único año —o ninguno— no se pinta
// nada: un filtro con una sola opción es un adorno que ocupa una fila y hay
// que leer para descubrir que no hace nada. Aparece por sí mismo el día que
// haya un segundo año, que es el día en que empieza a ahorrar tiempo. Hoy
// (11/09/2026) las 10 bajas de Lyceo son todas de 2026, así que Jorge no lo
// verá hasta enero.
//
// El número va en el chip a propósito: "2026 · 10" dice algo antes de
// pulsarlo. Sin él hay que entrar en cada año para saber si tiene uno o
// cuarenta.
//
// Se reutilizan .ac-chips/.ac-chip, que ya son el patrón de selección de
// este panel (las asignaturas del diario, los niveles) — nada de CSS nuevo
// para una tercera forma de elegir una cosa de una lista.
export function buildFiltroAnio(anios, anioActivo, onSelect) {
  if (!Array.isArray(anios) || anios.length < 2) return null;

  const wrap = document.createElement("div");
  wrap.className = "ac-chips";

  const total = anios.reduce((suma, a) => suma + (Number(a?.total) || 0), 0);
  const opciones = [{ anio: null, etiqueta: "Todos", total }, ...anios.map((a) => ({
    anio: a.anio,
    etiqueta: String(a.anio),
    total: Number(a.total) || 0,
  }))];

  for (const opcion of opciones) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ac-chip";
    btn.classList.toggle("on", opcion.anio === anioActivo);
    btn.textContent = `${opcion.etiqueta} · ${opcion.total}`;
    // Volver a pulsar el año activo no lo apaga: para eso está "Todos". Un
    // filtro que se desactiva solo al repetir el clic deja al usuario sin
    // saber si está viendo todo o una parte.
    btn.addEventListener("click", () => {
      if (opcion.anio !== anioActivo) onSelect(opcion.anio);
    });
    wrap.appendChild(btn);
  }

  return wrap;
}
