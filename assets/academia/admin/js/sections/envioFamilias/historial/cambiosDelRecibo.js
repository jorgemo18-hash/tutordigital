import { fetchHistorialRecibos, recuperarEstadoRecibo } from "../../../apiHistorialRecibos.js";
import { formatoEuros } from "../../../../../../shared/js/formatoDinero.js";

// "CAMBIOS DE ESTE RECIBO": lo que ha pasado con el recibo de una familia en
// un mes, incluido si se borró y se rehízo (migración 134). Y, si al
// rehacerlo se perdió el envío o el pago, un botón para devolverlos.
//
// Es lo que habría evitado la tarde del 24/09/2026: las marcas de pago de
// septiembre se perdieron con un Regenerar y no había dónde mirarlas.

const fecha = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "numeric" });
};
const cuando = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.toLocaleDateString("es-ES", { day: "numeric", month: "numeric" })} ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
};
const ESTADO = { borrador: "sin enviar", enviado: "enviado", pagado: "pagado" };

// Qué cambió en un "cambio": importe, descuento, número. Texto corto.
function diferencias(antes = {}, despues = {}) {
  const partes = [];
  if (antes.total_neto !== despues.total_neto) partes.push(`importe ${formatoEuros(antes.total_neto)} → ${formatoEuros(despues.total_neto)}`);
  if (antes.descuento_puntual_pct !== despues.descuento_puntual_pct) partes.push(`descuento ${antes.descuento_puntual_pct ?? 0} % → ${despues.descuento_puntual_pct ?? 0} %`);
  if (antes.numero_recibo !== despues.numero_recibo) partes.push("número de recibo");
  return partes.join(", ") || "datos del recibo";
}

export function textoDelEvento(e) {
  const a = e.antes || {};
  const d = e.despues || {};
  switch (e.accion) {
    case "creado": return `Creado · ${formatoEuros(d.total_neto)}`;
    case "envio": return "Enviado a la familia";
    case "pago": return `Marcado como pagado${d.fecha_pago ? ` (${fecha(d.fecha_pago)})` : ""}`;
    case "pago_quitado": return "Quitada la marca de pago";
    case "borrado": return `Borrado al rehacerlo · estaba ${a.estado === "pagado" && a.fecha_pago ? `pagado el ${fecha(a.fecha_pago)}` : (ESTADO[a.estado] || a.estado)}`;
    default: return `Cambiado: ${diferencias(a, d)}`;
  }
}

export function textoRecuperable(r) {
  if (!r) return "";
  const que = r.estado === "pagado"
    ? `pagado${r.fecha_pago ? ` el ${fecha(r.fecha_pago)}` : ""}`
    : `enviado${r.fecha_envio ? ` el ${fecha(r.fecha_envio)}` : ""}`;
  return `Al rehacerlo se perdió que estaba ${que}.`;
}

export function buildCambiosDelRecibo({ familiaId, mes, anio, reciboId, onRecuperado,
  fetchHistorial = fetchHistorialRecibos, recuperar = recuperarEstadoRecibo }) {
  const wrap = document.createElement("section");
  wrap.className = "ef-cambios";
  const titulo = document.createElement("h3");
  titulo.className = "ef-cambios-titulo";
  titulo.textContent = "Cambios de este recibo";
  const cuerpo = document.createElement("div");
  cuerpo.className = "ef-cambios-cuerpo";
  cuerpo.textContent = "Cargando…";
  wrap.append(titulo, cuerpo);

  async function cargar() {
    let datos;
    try {
      datos = await fetchHistorial({ familia_id: familiaId, mes, anio });
    } catch (err) {
      cuerpo.textContent = err?.message || "No se pudo cargar el historial.";
      return;
    }
    cuerpo.innerHTML = "";
    if (datos.recuperable && reciboId) cuerpo.appendChild(avisoRecuperable(datos.recuperable));
    if (!datos.eventos.length) {
      const p = document.createElement("p");
      p.className = "ef-cambios-vacio";
      p.textContent = "Sin cambios apuntados. El historial solo recoge lo que pasa desde que se activó.";
      cuerpo.appendChild(p);
      return;
    }
    const lista = document.createElement("ol");
    lista.className = "ef-cambios-lista";
    for (const e of [...datos.eventos].reverse()) {
      const li = document.createElement("li");
      const hora = document.createElement("span");
      hora.className = "ef-cambios-hora";
      hora.textContent = cuando(e.created_at);
      const que = document.createElement("span");
      que.textContent = textoDelEvento(e);
      li.className = `ef-cambios-${e.accion}`;
      li.append(hora, que);
      lista.appendChild(li);
    }
    cuerpo.appendChild(lista);
  }

  function avisoRecuperable(r) {
    const caja = document.createElement("div");
    caja.className = "ac-aviso-mes ac-aviso-mes--alerta ef-cambios-recuperar";
    const texto = document.createElement("span");
    texto.textContent = textoRecuperable(r);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ac-btn copper";
    btn.textContent = "Recuperarlo";
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Recuperando…";
      try {
        await recuperar(reciboId);
        await onRecuperado?.();
        await cargar();
      } catch (err) {
        texto.textContent = err?.message || "No se pudo recuperar.";
        btn.disabled = false;
        btn.textContent = "Recuperarlo";
      }
    });
    caja.append(texto, btn);
    return caja;
  }

  cargar();
  return wrap;
}
