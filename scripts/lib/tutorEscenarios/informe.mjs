// EL INFORME: una tabla para ver de un vistazo y, debajo, cada respuesta que
// falló con el motivo, para poder leerla. Markdown para abrirlo en cualquier
// sitio y guardarlo junto a los anteriores y compararlos.
import { DIMENSIONES } from "./juez.mjs";

const NOMBRE_DIM = { carga: "Carga", activo: "Activo", metacognicion: "Metacog.", curiosidad: "Curios.", adaptacion: "Adapt." };

function nota(n) {
  return n == null ? "—" : n.toFixed(1).replace(".", ",");
}

export function textoDelInforme(resultados, { fecha, modelo, modeloJuez }) {
  const total = resultados.reduce((s, r) => s + r.veces, 0);
  const bien = resultados.reduce((s, r) => s + r.bien, 0);
  const lineas = [
    `# Escenarios del tutor — ${fecha}`,
    "",
    `Tutor: \`${modelo}\` · Juez: \`${modeloJuez || "sin juez"}\` · ${bien} de ${total} respuestas bien.`,
    "",
    `| Escenario | Bien | ${DIMENSIONES.map((d) => NOMBRE_DIM[d]).join(" | ")} |`,
    `|---|---|${DIMENSIONES.map(() => "---").join("|")}|`,
  ];
  for (const r of resultados) {
    lineas.push(`| ${r.que} | ${r.bien}/${r.veces} | ${DIMENSIONES.map((d) => nota(r.media[d])).join(" | ")} |`);
  }

  const malas = resultados.flatMap((r) => r.intentos.map((t, i) => ({ r, t, i })).filter(({ t }) => !t.reglas.ok || (t.juez && !t.juez.cumple)));
  lineas.push("", "## Respuestas que fallaron", "");
  if (!malas.length) lineas.push("Ninguna.");
  for (const { r, t, i } of malas) {
    lineas.push(`### ${r.que} (intento ${i + 1})`, "");
    lineas.push("> " + (t.reply || "(sin respuesta)").split("\n").join("\n> "), "");
    for (const f of t.reglas.fallos) lineas.push(`- Regla **${f.regla}**: ${f.detalle}`);
    if (t.juez && !t.juez.cumple) lineas.push(`- Juez: ${t.juez.motivo}`);
    lineas.push("");
  }
  return lineas.join("\n");
}

// Lo que de verdad no puede pasar: regalar la solución o que se vea una
// señal. Si pasa, el script sale con error (sirve para usarlo antes de subir
// un cambio del prompt).
export function hayFallosGraves(resultados) {
  return resultados.some((r) => r.intentos.some((t) => t.reglas.fallos.some((f) => f.regla === "no-regala" || f.regla === "sin-senales")));
}
