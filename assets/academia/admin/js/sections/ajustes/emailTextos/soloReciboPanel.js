import { buildEmailTextoPanel } from "./emailTextoPanelBase.js";

// Email cuando el envío lleva SOLO el recibo (sin informe) — p.ej. cuando
// secretaría se equivocó y solo tiene que reenviar el recibo.
export function buildEmailTextoSoloReciboPanel(deps) {
  return buildEmailTextoPanel({
    campo: "email_texto_solo_recibo",
    titulo: "Email — solo recibo",
    descripcion: "Texto de acompañamiento cuando el envío lleva únicamente el recibo.",
    variables: ["{mes}", "{anio}", "{total}", "{familia}"],
    variablesEsperadas: ["{total}"],
    ...deps,
  });
}
