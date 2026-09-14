import { NIVELES, etiquetaNivel } from "../../../shared/js/niveles.js";

// El color y la clase CSS de cada nivel. La LISTA de niveles no vive aquí:
// vive en shared/js/niveles.js, porque ahora también la usa el horario del
// centro (reservar una hora para un curso). Aquí queda solo lo que es
// propio del panel del profesor, que es cómo se pinta.
const COLORES = {
  primaria: { cls: "pri", color: "#cf6b52" },
  eso: { cls: "eso", color: "#d39a44" },
  bachillerato: { cls: "bach", color: "#7ba0c4" },
};

const NIVELES_INFO = Object.fromEntries(
  NIVELES.map((n) => [n.id, { cls: COLORES[n.id].cls, label: n.label, color: COLORES[n.id].color }])
);

export function nivelInfo(nivel) {
  return NIVELES_INFO[nivel] || { cls: "eso", label: etiquetaNivel(nivel) || "—", color: "#d39a44" };
}
