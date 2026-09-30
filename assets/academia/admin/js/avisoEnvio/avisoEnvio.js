import { textoDelEnvio } from "../../../../shared/js/periodosDeEnvio.js";
import { alumnosDelInforme } from "../sections/envioFamilias/alumnosDelInforme.js";

// EL AVISO DE "TOCA ENVIAR", arriba del todo en cualquier sección del panel.
//
// POR QUÉ (Jorge, 30/09/2026): *"que en los ajustes pudieras configurar qué
// día quieres enviar las facturas y los informes… y el primer día que entres
// a partir de ese día, que salga un aviso: ¿quieres enviar? Revisar"*. Así no
// hay que estar pendiente cada mes.
//
// DOS DECISIONES, las dos habladas con él:
//   - NO ES UNA VENTANA QUE SALE UNA VEZ: es una franja que se queda hasta que
//     el envío está hecho. Una ventana se cierra sin leer, y si ese día no se
//     puede, se olvida.
//   - SOLO "REVISAR", NO "ENVIAR": lleva a Envío a familias con el mes
//     preparado. Los informes hay que leerlos antes de mandarlos.
//
// QUÉ MES: desde el día configurado, el del mes en curso. Antes de ese día,
// el del mes ANTERIOR si se quedó sin hacer: un envío que no se hizo no
// puede desaparecer en silencio solo porque ha cambiado el mes.

// Cálculo puro: el envío que toca mirar hoy, o null si el centro no ha
// configurado día.
export function envioAMirar(hoy, diaEnvio) {
  const dia = Number(diaEnvio);
  if (!Number.isInteger(dia) || dia < 1) return null;
  const mes = hoy.getMonth() + 1;
  const anio = hoy.getFullYear();
  if (hoy.getDate() >= dia) return { mes, anio, esDeEsteMes: true };
  return mes === 1 ? { mes: 12, anio: anio - 1, esDeEsteMes: false } : { mes: mes - 1, anio, esDeEsteMes: false };
}

// Familias a las que todavía les falta algo del envío. Las que no tienen
// email NO cuentan: no se les puede mandar nada por correo, ya tienen su
// propio aviso en Envío a familias, y contarlas dejaría la franja puesta
// para siempre.
export function familiasPendientes(items = []) {
  return items.filter((f) => {
    if (!String(f.familia_email || "").trim()) return false;
    const tieneActivos = (f.alumnos_activos || []).length > 0;
    const reciboPendiente = tieneActivos && (!f.recibo || !f.recibo.fecha_envio);
    const informePendiente = alumnosDelInforme(f).some((a) => a.tiene_sesiones && !a.informe_enviado_at);
    return reciboPendiente || informePendiente;
  });
}

export function textoAviso({ mes, anio }, periodoInforme, pendientes) {
  const n = pendientes.length;
  const familias = n === 1 ? "1 familia pendiente" : `${n} familias pendientes`;
  return `Toca el envío a familias — ${textoDelEnvio({ mes, anio }, periodoInforme).toLowerCase()} · ${familias}`;
}

// Monta la franja en `contenedor` y devuelve `actualizar()`, que se llama al
// arrancar y cada vez que se cambia de sección (así desaparece en cuanto se
// termina de enviar). Sin día configurado no hace ni una petición.
export function crearAvisoEnvio({ contenedor, diaEnvio, fetchRecibosFn, onRevisar, hoyFn = () => new Date() }) {
  async function actualizar() {
    const toca = envioAMirar(hoyFn(), diaEnvio);
    if (!toca) { contenedor.innerHTML = ""; return; }
    let datos;
    try {
      datos = await fetchRecibosFn({ mes: toca.mes, anio: toca.anio });
    } catch {
      return; // un aviso que no puede calcularse no bloquea el panel
    }
    const pendientes = familiasPendientes(datos.recibos || []);
    contenedor.innerHTML = "";
    if (!pendientes.length) return;

    const franja = document.createElement("div");
    franja.className = "ac-aviso-envio";
    franja.setAttribute("role", "status");
    const texto = document.createElement("span");
    texto.textContent = textoAviso(toca, datos.periodoInforme, pendientes);
    const revisar = document.createElement("button");
    revisar.type = "button";
    revisar.className = "ac-btn primary";
    revisar.textContent = "Revisar";
    revisar.addEventListener("click", () => onRevisar({ mes: toca.mes, anio: toca.anio }));
    franja.append(texto, revisar);
    contenedor.appendChild(franja);
  }
  return { actualizar };
}
