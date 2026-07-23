function estadoDe(profesor) {
  if (profesor.invite?.status === "pending") return { texto: "Invitación pendiente", clase: "pendiente" };
  if (profesor.is_active) return { texto: "Activo", clase: "pagado" };
  return { texto: "Inactivo", clase: "inactivo" };
}

// Listado de profesores del tenant — reutiliza GET /admin/teachers tal
// cual (mismo endpoint que instituto, ver apiProfesores.js). `onRevocar`
// solo se invoca para invitaciones aún pendientes (no hay nada que
// revocar sobre un profesor ya activo).
export function buildTablaProfesores(profesores, { onRevocar }) {
  const wrap = document.createElement("div");
  wrap.className = "ac-tabla-profesores-wrap";

  if (!profesores.length) {
    const p = document.createElement("p");
    p.className = "ac-empty";
    p.textContent = "Todavía no hay profesores en este centro.";
    wrap.appendChild(p);
    return wrap;
  }

  const tabla = document.createElement("table");
  tabla.className = "ac-tabla-profesores";

  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Nombre</th><th>Email</th><th>Estado</th><th></th></tr>";
  tabla.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const profesor of profesores) {
    const tr = document.createElement("tr");
    const estado = estadoDe(profesor);

    const tdNombre = document.createElement("td");
    tdNombre.textContent = profesor.display_name || "—";
    const tdEmail = document.createElement("td");
    tdEmail.textContent = profesor.email;
    const tdEstado = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `ac-estado-badge ${estado.clase}`;
    badge.textContent = estado.texto;
    tdEstado.appendChild(badge);
    const tdAccion = document.createElement("td");

    if (estado.clase === "pendiente" && profesor.invite?.id) {
      const revocarBtn = document.createElement("button");
      revocarBtn.type = "button";
      revocarBtn.className = "ac-btn ghost sm";
      revocarBtn.textContent = "Revocar";
      revocarBtn.addEventListener("click", () => onRevocar(profesor));
      tdAccion.appendChild(revocarBtn);
    }

    tr.append(tdNombre, tdEmail, tdEstado, tdAccion);
    tbody.appendChild(tr);
  }
  tabla.appendChild(tbody);
  wrap.appendChild(tabla);
  return wrap;
}
