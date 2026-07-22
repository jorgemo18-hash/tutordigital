import { MESES } from "./textoAcompanamiento.js";

// Nombre de archivo normalizado (sin acentos ni espacios) para los PDF
// adjuntos — compartido entre el envío por familia y el envío individual
// de informe, para que ambos nombren igual.
function normalizar(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita los acentos ya separados por NFD
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function nombreArchivoRecibo(familiaNombre, mes, anio) {
  return `recibo-${normalizar(familiaNombre)}-${normalizar(MESES[mes])}-${anio}.pdf`;
}

export function nombreArchivoInforme(alumnoNombre, mes, anio) {
  return `informe-${normalizar(alumnoNombre)}-${normalizar(MESES[mes])}-${anio}.pdf`;
}
