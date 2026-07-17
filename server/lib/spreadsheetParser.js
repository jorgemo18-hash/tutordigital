import readXlsxFile from "read-excel-file/node";
import Papa from "papaparse";

// Adaptador fino sobre las dos librerías de parseo (read-excel-file para
// .xlsx, papaparse para .csv) — devuelve siempre la misma forma (tabla de
// filas de celdas, primera fila = cabecera) para que server/lib/importReview.js
// no necesite saber qué formato llegó. Sin lógica de negocio aquí: eso vive
// en importReview.js (pura, testeable sin E/S).

export class UnsupportedFileTypeError extends Error {}
export class CorruptFileError extends Error {}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseCsvBuffer(buffer) {
  const text = stripBom(buffer.toString("utf-8"));
  const result = Papa.parse(text.trim(), { skipEmptyLines: true });
  if (result.errors?.length && !result.data?.length) {
    throw new CorruptFileError("No se pudo leer el archivo CSV.");
  }
  return result.data;
}

async function parseXlsxBuffer(buffer) {
  let result;
  try {
    result = await readXlsxFile(buffer);
  } catch (err) {
    throw new CorruptFileError("No se pudo leer el archivo Excel (.xlsx).");
  }
  // Esta versión de read-excel-file/node siempre devuelve Sheet[] (uno por
  // hoja del libro, forma {sheet, data}) en vez de la tabla de filas directa
  // — se usa solo la primera hoja, que es la que interesa para este import.
  const rows = Array.isArray(result) && result[0] && Array.isArray(result[0]?.data) ? result[0].data : result;
  if (!Array.isArray(rows)) throw new CorruptFileError("El archivo Excel no tiene ninguna hoja con datos.");
  return rows.map((row) => row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))));
}

/**
 * @param {{ buffer: Buffer, filename: string }} args
 * @returns {Promise<string[][]>} tabla de filas de celdas (texto), primera fila = cabecera
 */
export async function parseSpreadsheetBuffer({ buffer, filename }) {
  const lower = String(filename || "").toLowerCase();
  if (lower.endsWith(".csv")) return parseCsvBuffer(buffer);
  if (lower.endsWith(".xlsx")) return parseXlsxBuffer(buffer);
  throw new UnsupportedFileTypeError("Formato no soportado: usa un archivo .csv o .xlsx.");
}
