function formatFechaHora(iso) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// Una fila por fichaje, SIEMPRE — original y corrección nunca se
// fusionan en una sola línea "limpia" (requisito explícito: apto para
// presentar ante una inspección de trabajo, hay que poder ver que hubo
// una corrección y por qué). `onCorregir(fichaje)` abre el diálogo de
// corrección ya anclado a esa fila concreta.
export function buildTablaFichajes(fichajes, { onCorregir }) {
  const wrap = document.createElement("div");
  wrap.className = "ac-tabla-fichajes-wrap";

  if (!fichajes.length) {
    const p = document.createElement("p");
    p.className = "ac-empty";
    p.textContent = "Sin fichajes en este período.";
    wrap.appendChild(p);
    return wrap;
  }

  const tabla = document.createElement("table");
  tabla.className = "ac-tabla-fichajes";

  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Fecha y hora</th><th>Tipo</th><th>Origen</th><th>Motivo / corregido por</th><th></th></tr>";
  tabla.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const f of fichajes) {
    const esCorreccion = f.origen === "admin_correccion";
    const tr = document.createElement("tr");
    tr.className = esCorreccion ? "ac-fila-correccion" : "";

    const tdFecha = document.createElement("td");
    tdFecha.textContent = formatFechaHora(f.timestamp);
    const tdTipo = document.createElement("td");
    tdTipo.textContent = f.tipo === "entrada" ? "Entrada" : "Salida";
    const tdOrigen = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `ac-estado-badge ${esCorreccion ? "amber" : ""}`;
    badge.textContent = esCorreccion ? "Corrección de admin" : "Fichado por el trabajador";
    tdOrigen.appendChild(badge);
    const tdMotivo = document.createElement("td");
    if (esCorreccion) {
      const base = `${f.motivo || ""} (${f.corregidoPorNombre || "admin"})`;
      tdMotivo.textContent = f.notas ? `${base} · ${f.notas}` : base;
    }
    const tdAccion = document.createElement("td");
    const corregirBtn = document.createElement("button");
    corregirBtn.type = "button";
    corregirBtn.className = "ac-btn ghost sm";
    corregirBtn.textContent = "Corregir";
    corregirBtn.addEventListener("click", () => onCorregir(f));
    tdAccion.appendChild(corregirBtn);

    tr.append(tdFecha, tdTipo, tdOrigen, tdMotivo, tdAccion);
    tbody.appendChild(tr);
  }
  tabla.appendChild(tbody);
  wrap.appendChild(tabla);
  return wrap;
}
