// «ÚLTIMAS CLASES» EN EL DRAWER DEL DIARIO: las cinco últimas clases del
// alumno antes del día que se escribe, con materia y tema, para ubicarse de
// un vistazo antes de rellenar el parte (Jorge, 1/10/2026).
//
// Se carga aparte y no bloquea nada: si tarda o falla, el formulario ya
// está ahí y se puede escribir igual.

// "2026-09-29" → "29/09". Texto, no Date: así no hay desfases de zona horaria.
export function fechaCorta(iso) {
  const [, m, d] = String(iso).split("-");
  return `${d}/${m}`;
}

// "Matemáticas — Fracciones · Inglés" (el tema, si lo hay).
export function textoDeBloques(bloques = []) {
  return bloques.map((b) => (b.tema ? `${b.materia} — ${b.tema}` : b.materia)).join(" · ");
}

export function buildUltimasClases(entry, fecha, { fetchRecientesFn }) {
  const wrap = document.createElement("div");
  wrap.className = "ac-ultimas-clases";
  const titulo = document.createElement("div");
  titulo.className = "ac-field-label";
  titulo.textContent = "Últimas clases";
  const cuerpo = document.createElement("div");
  cuerpo.className = "ac-ultimas-clases-cuerpo";
  cuerpo.textContent = "Cargando…";
  wrap.append(titulo, cuerpo);

  fetchRecientesFn(entry.alumno_id, fecha)
    .then((sesiones) => {
      cuerpo.textContent = "";
      if (!sesiones.length) {
        cuerpo.textContent = "Todavía no hay clases anteriores registradas.";
        return;
      }
      const lista = document.createElement("ul");
      lista.className = "ac-ultimas-clases-lista";
      for (const s of sesiones) {
        const li = document.createElement("li");
        const dia = document.createElement("span");
        dia.className = "ac-ultimas-clases-fecha";
        dia.textContent = fechaCorta(s.fecha);
        const que = document.createElement("span");
        que.textContent = textoDeBloques(s.bloques);
        li.append(dia, que);
        lista.appendChild(li);
      }
      cuerpo.appendChild(lista);
    })
    .catch(() => {
      cuerpo.textContent = "No se pudieron cargar las últimas clases.";
    });

  return wrap;
}
