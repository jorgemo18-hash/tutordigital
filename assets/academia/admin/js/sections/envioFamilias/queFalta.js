import { compararNombres } from "../../../../../shared/js/ordenAlumnos.js";

// "LO QUE FALTA" PARA PODER HACER EL ENVÍO DEL MES, en Envío a familias.
//
// POR QUÉ (Jorge, 30/09/2026): *"la lista de lo que falta, que si le clicas
// te ponga quién es"*. Antes, para saber si ya se podía enviar había que
// abrir familia por familia. Aquí se dice cuántos faltan de cada cosa y, al
// pulsar, QUIÉNES; y al pulsar un nombre, se abre esa familia en el panel.
//
// SOLO LO QUE IMPIDE ENVIAR BIEN ESTE MES:
//   - familias sin recibo del mes del envío (el recibo no está creado);
//   - alumnos que tuvieron clase en el mes del informe y cuyo informe no
//     está redactado (sin comentario no se adjunta: saldría solo el recibo).
// Un alumno sin clases ese mes NO cuenta: no tiene nada que contar y su
// informe no falta. Los que no tienen precio o email ya tienen sus propios
// avisos debajo (alumnosSinPrecio.js, familiasSinEmail.js), que además
// explican qué pasará con ellos.
//
// SE LEE DEL LISTADO YA CARGADO (`recibo`, `tiene_sesiones` e
// `informe_redactado` de cada familia, ver lib/academiaEnvio/
// listadoDelEnvio.js). Ninguna consulta nueva.

const MESES = [
  null, "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// Cálculo puro: [{ clave, titulo, personas: [{ familiaId, etiqueta }] }],
// solo las categorías que tienen a alguien, cada una ordenada por nombre.
export function queFalta(familias = [], { mes, periodoInforme } = {}) {
  const mesInforme = (periodoInforme || { mes }).mes;
  const sinRecibo = familias
    .filter((f) => !f.recibo)
    .map((f) => ({ familiaId: f.familia_id, etiqueta: f.familia_nombre || "(sin nombre)" }));
  const sinInforme = familias.flatMap((f) =>
    (f.alumnos_activos || [])
      .filter((a) => a.tiene_sesiones && !a.informe_redactado && !a.informe_enviado_at)
      .map((a) => ({ familiaId: f.familia_id, etiqueta: `${a.nombre} (${f.familia_nombre || "sin familia"})` }))
  );
  const porNombre = (a, b) => compararNombres(a.etiqueta, b.etiqueta);
  const n = (x, uno, varios) => `${x.length} ${x.length === 1 ? uno : varios}`;
  return [
    { clave: "recibos", titulo: `${n(sinRecibo, "familia", "familias")} sin recibo de ${MESES[mes] || ""}`, personas: sinRecibo.sort(porNombre) },
    {
      clave: "informes",
      titulo: `${n(sinInforme, "informe", "informes")} de ${MESES[mesInforme] || ""} sin redactar`,
      personas: sinInforme.sort(porNombre),
    },
  ].filter((c) => c.personas.length);
}

// Una línea por categoría que se despliega (<details>) con los nombres;
// cada nombre es un botón que abre su familia. Sin nada pendiente, lo dice:
// una lista vacía no distingue "todo listo" de "no ha cargado".
export function buildQueFalta(familias, { mes, periodoInforme, onSelect }) {
  const wrap = document.createElement("div");
  wrap.className = "ef-que-falta";
  if (!familias.length) return wrap;

  const categorias = queFalta(familias, { mes, periodoInforme });
  if (!categorias.length) {
    const listo = document.createElement("p");
    listo.className = "ef-que-falta-listo";
    listo.textContent = "Recibos creados e informes redactados: todo listo para enviar.";
    wrap.appendChild(listo);
    return wrap;
  }

  for (const categoria of categorias) {
    const details = document.createElement("details");
    details.className = "ef-que-falta-categoria";
    details.dataset.clave = categoria.clave;
    const summary = document.createElement("summary");
    summary.textContent = categoria.titulo;
    details.appendChild(summary);

    const lista = document.createElement("div");
    lista.className = "ef-que-falta-personas";
    for (const persona of categoria.personas) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ef-que-falta-persona";
      btn.textContent = persona.etiqueta;
      btn.addEventListener("click", () => {
        const familia = familias.find((f) => f.familia_id === persona.familiaId);
        if (familia) onSelect?.(familia);
      });
      lista.appendChild(btn);
    }
    details.appendChild(lista);
    wrap.appendChild(details);
  }
  return wrap;
}
