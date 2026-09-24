// EL CONTENIDO DE LA HOJA "LA TAREA" DEL MÓVIL (se abre tocando el título).
//
// Todo con textContent: la descripción y las notas las escribe un profesor
// y no deben interpretarse como HTML.

function bloque(doc, etiqueta, texto) {
  const sec = doc.createElement("section");
  sec.className = "mtd-bloque";
  const k = doc.createElement("p");
  k.className = "mtd-k";
  k.textContent = etiqueta;
  const v = doc.createElement("p");
  v.className = "mtd-v";
  v.textContent = texto;
  sec.append(k, v);
  return sec;
}

export function pintarDetalleDeTarea(cont, detalle, { doc = document, alAbrirAdjunto = () => {} } = {}) {
  if (!cont) return;
  cont.replaceChildren();
  if (!detalle) return;

  const titulo = doc.createElement("h3");
  titulo.className = "mtd-titulo";
  titulo.textContent = detalle.titulo || "Tarea";
  cont.appendChild(titulo);

  if (detalle.entrega) cont.appendChild(bloque(doc, "Entrega", detalle.entrega));
  cont.appendChild(bloque(doc, "Qué hay que hacer", detalle.descripcion || "El profesor no ha escrito descripción."));
  if (detalle.notas) cont.appendChild(bloque(doc, "Nota del profesor", detalle.notas));

  if (detalle.adjuntos.length) {
    const sec = doc.createElement("section");
    sec.className = "mtd-bloque";
    const k = doc.createElement("p");
    k.className = "mtd-k";
    k.textContent = detalle.adjuntos.length === 1 ? "Archivo" : "Archivos";
    sec.appendChild(k);
    for (const adj of detalle.adjuntos) {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = "mtd-adjunto";
      b.textContent = adj.nombre;
      b.addEventListener("click", () => alAbrirAdjunto(adj.id));
      sec.appendChild(b);
    }
    cont.appendChild(sec);
  }
}
