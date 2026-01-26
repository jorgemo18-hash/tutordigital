const agendaMock = {
  deberes: [
    { id: "deb-lengua", title: "Lengua", detail: "Ejercicios 3 y 4 (pág. 78)" },
    { id: "deb-tecno", title: "Tecnología", detail: "Ejercicios 1 y 2 (tema 3)" },
    { id: "deb-mates", title: "Matemáticas", detail: "Problema 5 (ficha adjunta)" },
  ],
  examenes: [
    { id: "ex-mates", title: "Matemáticas", detail: "temas 2", meta: "viernes" },
    { id: "ex-lengua", title: "Lengua", detail: "temas 5", meta: "lunes" },
  ],
  trabajos: [
    { id: "tr-hist", title: "Historia", detail: "imperio romano", meta: "entrega en 15 días" },
  ],
};

function buildLabel(item) {
  const { title, detail, meta } = item || {};
  return String(title || "") +
    (detail ? " · " + detail : "") +
    (meta ? " · " + meta : "");
}

function normalizeType(type) {
  if (!type) return type;
  const t = String(type).toLowerCase();
  if (t.includes("deber")) return "deberes";
  if (t.includes("exam")) return "examenes";
  if (t.includes("trab")) return "trabajos";
  return type;
}

function getItemsByType(type) {
  const key = normalizeType(type);
  return agendaMock && agendaMock[key] ? agendaMock[key] : [];
}

export { agendaMock, buildLabel, normalizeType, getItemsByType };
