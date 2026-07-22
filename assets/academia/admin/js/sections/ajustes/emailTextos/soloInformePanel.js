import { buildEmailTextoPanel } from "./emailTextoPanelBase.js";

// Email cuando el envío lleva SOLO informe(s) — sin recibo, así que sin
// {total} (no ofrecerlo aquí evita el bug que motivó este rediseño: un
// texto compartido que prometía un importe/adjunto que no iba en el
// envío).
export function buildEmailTextoSoloInformePanel(deps) {
  return buildEmailTextoPanel({
    campo: "email_texto_solo_informe",
    titulo: "Email — solo informe",
    descripcion: "Texto de acompañamiento cuando el envío lleva únicamente el informe.",
    variables: ["{mes}", "{anio}", "{familia}"],
    variablesEsperadas: [],
    ...deps,
  });
}
