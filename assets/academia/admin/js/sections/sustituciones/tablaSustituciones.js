import { formatRangoFechasEs } from "../../utils/formatFecha.js";

// `hoyISO` explícito (no `new Date()` cerrado aquí dentro) para poder
// testear los tres estados (futura/activa/finalizada) sin depender del
// reloj real.
export function estadoDeSustitucion(sustitucion, hoyISO) {
  if (sustitucion.revocada_at) return { texto: "Revocada", clase: "inactivo" };
  if (sustitucion.fecha_fin < hoyISO) return { texto: "Finalizada", clase: "borrador" };
  if (sustitucion.fecha_inicio > hoyISO) return { texto: "Futura", clase: "amber" };
  return { texto: "Activa", clase: "pagado" };
}

// Listado de sustituciones del centro (activas e históricas) — vista del
// admin. `onRevocar` solo se ofrece sobre filas todavía sin revocar (no
// tiene sentido revocar dos veces, y una ya finalizada por fecha no
// necesita revocación: ya dejó de aplicar sola).
export function buildTablaSustituciones(sustituciones, { hoyISO, onRevocar }) {
  const wrap = document.createElement("div");
  wrap.className = "ac-tabla-wrap";

  if (!sustituciones.length) {
    const p = document.createElement("p");
    p.className = "ac-empty";
    p.textContent = "Todavía no hay ninguna sustitución registrada en este centro.";
    wrap.appendChild(p);
    return wrap;
  }

  const tabla = document.createElement("table");
  tabla.className = "ac-tabla";
  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Sustituto</th><th>Sustituido</th><th>Fechas</th><th>Declarada por</th><th>Estado</th><th></th></tr>";
  tabla.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const s of sustituciones) {
    const tr = document.createElement("tr");
    const estado = estadoDeSustitucion(s, hoyISO);

    const tdSustituto = document.createElement("td");
    tdSustituto.textContent = s.sustituto_nombre || "—";
    const tdSustituido = document.createElement("td");
    tdSustituido.textContent = s.sustituido_nombre || "—";
    const tdFechas = document.createElement("td");
    tdFechas.textContent = formatRangoFechasEs(s.fecha_inicio, s.fecha_fin);
    const tdDeclarada = document.createElement("td");
    tdDeclarada.textContent = s.declarada_por_nombre || "—";
    const tdEstado = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `ac-estado-badge ${estado.clase}`;
    badge.textContent = estado.texto;
    tdEstado.appendChild(badge);
    const tdAccion = document.createElement("td");

    // Ni una ya revocada ni una ya finalizada (fecha_fin < hoy) se pueden
    // revocar: la primera porque ya lo está, la segunda porque su efecto ya
    // ocurrió — revocarla no retira ningún acceso y solo ensucia el
    // histórico (ver revocarSustitucion en el backend, que además lo
    // rechaza aunque alguien se salte esta UI).
    if (!s.revocada_at && estado.texto !== "Finalizada") {
      const revocarBtn = document.createElement("button");
      revocarBtn.type = "button";
      revocarBtn.className = "ac-btn ghost sm";
      revocarBtn.textContent = "Revocar";
      revocarBtn.addEventListener("click", () => onRevocar(s));
      tdAccion.appendChild(revocarBtn);
    }

    tr.append(tdSustituto, tdSustituido, tdFechas, tdDeclarada, tdEstado, tdAccion);
    tbody.appendChild(tr);
  }
  tabla.appendChild(tbody);
  wrap.appendChild(tabla);
  return wrap;
}
