function etiquetaDia(dia) {
  if (dia.ausencia) return { texto: "Ausencia", clase: "ausencia" };
  if (dia.festivo) return { texto: dia.festivo, clase: "festivo" };
  return { texto: [dia.asignatura, dia.tema].filter(Boolean).join(" — "), clase: "" };
}

// Tabla compacta "Día | Detalle" a partir del array `dias` que devuelve el
// backend (ver server/lib/academiaInformes/diasMes.js) — mismo dato que
// arma la tabla del PDF (generators/informe.py del microservicio), aquí en
// versión resumida: solo los días con algo que mostrar, no los 30/31 del mes.
export function buildDiasTable(dias) {
  const wrap = document.createElement("div");
  wrap.className = "ac-table-wrap";

  if (!dias.length) {
    const p = document.createElement("p");
    p.className = "ac-empty";
    p.textContent = "Sin sesiones este mes.";
    wrap.appendChild(p);
    return wrap;
  }

  const ordenados = [...dias].sort((a, b) => a.dia - b.dia);
  const table = document.createElement("table");
  table.className = "ac-table";
  const tbody = document.createElement("tbody");
  for (const dia of ordenados) {
    const { texto, clase } = etiquetaDia(dia);
    const row = document.createElement("tr");
    if (clase) row.className = `ef-dia-${clase}`;
    const tdDia = document.createElement("td");
    tdDia.textContent = String(dia.dia).padStart(2, "0");
    tdDia.className = "ef-dia-numero";
    const tdTexto = document.createElement("td");
    tdTexto.textContent = texto;
    row.append(tdDia, tdTexto);
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}
