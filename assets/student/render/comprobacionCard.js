// LA TARJETA ✓ / ✗ DEL COMPROBADOR (decidido con Jorge el 2/10/2026).
//
// Cuando el alumno manda cuentas de un ejercicio de nuestras hojas, el
// servidor las comprueba con código y manda, ANTES que la respuesta del
// tutor, la lista de pasos con su marca (evento SSE «comprobacion»). Aquí se
// dibuja: sobria, sin aspecto de juego, y la lista SE PARA en el primer ✗
// (lo que viene después no se enseña: sería darle el plan).
//
//   ✓ hecho · ✗ el paso donde está el primer error · · pendiente ·
//   ? no lo decide el código (lo valora el tutor)
//
// Se coloca justo ENCIMA de la burbuja del tutor que se está escribiendo:
// primero la lista, después su comentario.
const MARCA = { hecho: "✓", mal: "✗", pendiente: "·", sin_decidir: "?" };

export function hitosVisibles(hitos = []) {
  const corte = hitos.findIndex((h) => h.estado === "mal");
  return corte === -1 ? hitos : hitos.slice(0, corte + 1);
}

export function createComprobacionCard({ chatList, scrollEl, isNearBottom }) {
  function addComprobacion(resumen) {
    if (!chatList || !resumen || !Array.isArray(resumen.hitos)) return null;

    const row = document.createElement("div");
    row.className = "row a";
    const card = document.createElement("div");
    card.className = `bubble comprobacionCard${resumen.todoHecho ? " comprobacionCard--hecho" : ""}`;

    const titulo = document.createElement("div");
    titulo.className = "comprobacionTitulo";
    titulo.textContent = resumen.apartado ? `Apartado ${resumen.apartado})` : "Tu ejercicio";
    card.appendChild(titulo);

    const lista = document.createElement("ul");
    lista.className = "comprobacionLista";
    hitosVisibles(resumen.hitos).forEach((h, i) => {
      const li = document.createElement("li");
      li.className = `comprobacionPaso comprobacionPaso--${h.estado}`;
      li.style.animationDelay = `${i * 120}ms`;
      const marca = document.createElement("span");
      marca.className = "comprobacionMarca";
      marca.setAttribute("aria-hidden", "true");
      marca.textContent = MARCA[h.estado] || "·";
      const texto = document.createElement("span");
      texto.textContent = h.titulo;
      li.append(marca, texto);
      li.setAttribute("aria-label", `${h.titulo}: ${{ hecho: "bien", mal: "revisar", pendiente: "pendiente", sin_decidir: "lo mira el tutor" }[h.estado] || ""}`);
      lista.appendChild(li);
    });
    card.appendChild(lista);

    if ((resumen.lineas || []).some((l) => l.estado === "duda")) {
      const nota = document.createElement("div");
      nota.className = "comprobacionNota";
      nota.textContent = "Hay algo que no he podido leer: te lo pregunto.";
      card.appendChild(nota);
    }

    row.appendChild(card);
    const enCurso = [...chatList.querySelectorAll(".bubble--streaming")].pop()?.closest(".row");
    const nearBottom = isNearBottom(140);
    if (enCurso && enCurso.parentNode === chatList) chatList.insertBefore(row, enCurso);
    else chatList.appendChild(row);
    if (nearBottom) requestAnimationFrame(() => { try { scrollEl.scrollTop = scrollEl.scrollHeight; } catch {} });
    return row;
  }

  return { addComprobacion };
}
