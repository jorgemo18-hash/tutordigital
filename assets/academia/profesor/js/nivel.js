const NIVELES = {
  primaria: { cls: "pri", label: "Primaria", color: "#cf6b52" },
  eso: { cls: "eso", label: "ESO", color: "#d39a44" },
  bachillerato: { cls: "bach", label: "Bachillerato", color: "#7ba0c4" },
};

export function nivelInfo(nivel) {
  return NIVELES[nivel] || { cls: "eso", label: nivel || "—", color: "#d39a44" };
}
