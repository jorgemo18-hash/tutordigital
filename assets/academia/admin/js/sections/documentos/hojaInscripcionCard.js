import { descargarHojaInscripcion } from "../../api.js";

// Tarjeta "Hoja de inscripción" — genera el PDF en el momento (sin guardar
// nada) y lo abre en una pestaña nueva. window.open(url) directo al
// endpoint no serviría: la API se autentica por header (Bearer), no por
// cookie, así que hay que descargar el blob ya autenticado y abrir un
// object URL local (mismo patrón que ctxFileManager.js en el panel alumno).
export function buildHojaInscripcionCard({ descargarFn = descargarHojaInscripcion } = {}) {
  const card = document.createElement("div");
  card.className = "ac-doc-card";

  const title = document.createElement("div");
  title.className = "ac-doc-card-title";
  title.textContent = "Hoja de inscripción";

  const sub = document.createElement("div");
  sub.className = "ac-doc-card-sub";
  sub.textContent = "Plantilla en PDF para captar datos del alumno y la familia";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-btn ghost";
  btn.textContent = "Vista previa";

  const msg = document.createElement("div");
  msg.className = "ac-drawer-msg";

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const textoOriginal = btn.textContent;
    btn.textContent = "Generando…";
    msg.textContent = "";
    msg.className = "ac-drawer-msg";
    // window.open() DEBE llamarse de forma síncrona dentro del gesto de
    // click — si se llama después de un await (p.ej. tras descargarFn()),
    // Chrome ya no lo asocia al gesto del usuario y bloquea la pestaña en
    // silencio, sin lanzar ningún error. Se abre en blanco ya mismo y se
    // navega a la URL real en cuanto el PDF esté listo.
    const nuevaVentana = window.open("", "_blank");
    try {
      const blob = await descargarFn();
      const url = URL.createObjectURL(blob);
      // No se revoca el object URL: la pestaña nueva sigue necesitándolo
      // mientras esté abierta y no hay un momento fiable para saber cuándo
      // el usuario la cierra.
      if (nuevaVentana) nuevaVentana.location.href = url;
      else msg.textContent = "El navegador bloqueó la pestaña nueva — permite ventanas emergentes para este sitio.";
    } catch (err) {
      nuevaVentana?.close();
      msg.textContent = err.message || "No se pudo generar la hoja de inscripción.";
      msg.className = "ac-drawer-msg error";
    }
    btn.disabled = false;
    btn.textContent = textoOriginal;
  });

  card.append(title, sub, btn, msg);
  return card;
}
