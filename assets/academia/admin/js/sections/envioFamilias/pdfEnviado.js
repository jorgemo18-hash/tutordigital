import { abrirPdf } from "../../../../../shared/generador/abrirPdf.js";

// "Enviado el 5 oct. a las 10:32 · Ver el PDF enviado": el documento EXACTO
// que recibió la familia (migración 147), bajo el recibo y bajo cada informe.
//
// Se enseña el ÚLTIMO. Si se mandó más de una vez (se mandó mal y se corrigió)
// se dice cuántas, pero no se listan: los anteriores quedan guardados para
// justificar, no para trabajar con ellos (decidido con Jorge, 30/09/2026).
//
// Sin envíos no pinta nada: la línea solo aparece cuando hay algo que ver.

const MESES_CORTOS = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sept.", "oct.", "nov.", "dic."];

export function textoPdfEnviado(documentos = []) {
  if (!documentos.length) return "";
  const fecha = new Date(documentos[0].enviado_at);
  const hora = `${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}`;
  const cuando = `Enviado el ${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]} a las ${hora}`;
  return documentos.length > 1 ? `${cuando} (se ha enviado ${documentos.length} veces; este es el último)` : cuando;
}

export function buildPdfEnviado({ api, familiaId, tipo, mes, anio, alumnoId = null }) {
  const linea = document.createElement("p");
  linea.className = "ef-pdf-enviado";
  if (!api?.fetchDocumentosEnviados || !familiaId) return linea;

  api.fetchDocumentosEnviados({ familia_id: familiaId, tipo, mes, anio, alumno_id: alumnoId })
    .then((documentos) => {
      if (!documentos.length) return;
      const texto = document.createElement("span");
      texto.textContent = `${textoPdfEnviado(documentos)} · `;
      const ver = document.createElement("button");
      ver.type = "button";
      ver.className = "ef-pdf-enviado-ver";
      ver.textContent = "Ver el PDF enviado";
      ver.addEventListener("click", () => {
        abrirPdf({
          pedirPdfFn: () => api.descargarDocumentoEnviado(documentos[0].id),
          queEs: "enviado",
          nombreArchivo: documentos[0].nombre_archivo,
        }).catch(() => { ver.textContent = "No se pudo abrir el PDF"; });
      });
      linea.append(texto, ver);
    })
    .catch(() => {}); // un dato de consulta que no carga no rompe la pestaña
  return linea;
}
