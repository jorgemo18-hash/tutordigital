import { buildEmailTextoPanel } from "./emailTextoPanelBase.js";

// Email cuando el envío lleva recibo + informe(s) — el caso más frecuente
// (botón "Enviar" por familia o "Enviar todos" sin restringir tipo). Ver
// server/lib/academiaEnvio/textoAcompanamiento.js, que hace la sustitución
// real al enviar.
export function buildEmailTextoCompletoPanel(deps) {
  return buildEmailTextoPanel({
    campo: "email_texto_completo",
    titulo: "Email — recibo + informe",
    descripcion: "Texto de acompañamiento cuando el envío lleva el recibo y el informe adjuntos.",
    variables: ["{mes}", "{anio}", "{total}", "{familia}"],
    variablesEsperadas: ["{total}"],
    ...deps,
  });
}
