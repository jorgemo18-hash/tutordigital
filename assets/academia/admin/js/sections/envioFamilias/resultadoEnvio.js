// Resultado de "Enviar a todos": qué salió entero, qué salió a medias y
// qué no salió.
//
// El envío por familia degrada a propósito: si el PDF del recibo falla pero
// el del informe se genera, el email se manda igual con lo que haya (ver
// enviarFamiliaEmail.js). El backend lo reporta —reciboAdjuntado,
// informesAdjuntados, informesElegibles— pero la interfaz descartaba la
// respuesta entera y contaba esos casos como envíos correctos, así que el
// banner decía "N familia(s) al día" cuando alguna familia había recibido
// el informe del mes y ninguna factura.
//
// Función pura: recibe lo que devolvió cada envío y decide en qué cubo cae.

// `tipo` es el del diálogo de "Enviar todos": completo | solo_recibo |
// solo_informe. Solo se echa en falta lo que ese envío debía incluir.
export function clasificarEnvio(tipo, respuesta = {}) {
  const faltas = [];

  const debiaLlevarRecibo = tipo !== "solo_informe";
  if (debiaLlevarRecibo && respuesta.reciboAdjuntado === false) {
    faltas.push("no se pudo generar el recibo");
  }

  const debiaLlevarInformes = tipo !== "solo_recibo";
  const elegibles = Number(respuesta.informesElegibles ?? 0);
  const adjuntados = Number(respuesta.informesAdjuntados ?? 0);
  if (debiaLlevarInformes && elegibles > adjuntados) {
    const faltan = elegibles - adjuntados;
    faltas.push(`faltó ${faltan} informe${faltan === 1 ? "" : "s"} de ${elegibles}`);
  }

  for (const aviso of respuesta.avisosEstado || []) faltas.push(aviso);

  return { completo: faltas.length === 0, faltas };
}

function buildLista(items, render) {
  const lista = document.createElement("ul");
  lista.style.margin = "6px 0 0";
  lista.style.paddingLeft = "18px";
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = render(item);
    lista.appendChild(li);
  }
  return lista;
}

export function buildResultadoEnvioTodos({ enviadas, parciales = [], errores }) {
  const hayProblemas = errores.length > 0 || parciales.length > 0;
  const wrap = document.createElement("div");
  wrap.className = `ac-banner ${hayProblemas ? "amber" : "green"}`;
  wrap.style.flexDirection = "column";
  wrap.style.alignItems = "flex-start";
  wrap.style.cursor = "default";

  const resumen = document.createElement("div");
  const partes = [`${enviadas} familia(s) al día.`];
  if (parciales.length) partes.push(`${parciales.length} recibieron un email incompleto.`);
  resumen.textContent = partes.join(" ");
  wrap.appendChild(resumen);

  if (parciales.length) {
    wrap.appendChild(buildLista(parciales, (p) => `${p.familia_nombre}: se envió, pero ${p.faltas.join("; ")}.`));
  }
  if (errores.length) {
    wrap.appendChild(buildLista(errores, (e) => `${e.familia_nombre}: ${e.motivo}`));
  }
  return wrap;
}
