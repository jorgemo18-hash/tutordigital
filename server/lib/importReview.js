import { z } from "zod";
import { normalizeEmail } from "./adminStudentHelpers.js";

// Construye la tabla de revisión del import masivo a partir de una tabla ya
// parseada (array de filas de celdas, primera fila = cabecera) — sin tocar
// Supabase, sin enviar nada: es una función pura, la garantía estructural de
// que la fase de previsualización no puede persistir ni enviar emails viene
// de que esta función ni siquiera recibe un cliente de Supabase ni un
// remitente de correo como parámetro.

export const NAME_HEADER_ALIASES = ["nombre", "alumno", "alumna", "estudiante", "nombre completo", "nombre y apellidos", "nombre del alumno"];
export const LAST_NAME_HEADER_ALIASES = ["apellidos", "apellido", "apellidos del alumno"];
export const EMAIL_HEADER_ALIASES = ["email", "correo", "correo electronico", "e-mail", "mail", "correo electrónico del alumno"];

const EmailSchema = z.string().email();

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function findColumnIndex(headerRow, aliases) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headerRow.findIndex((cell) => normalizedAliases.includes(normalizeHeader(cell)));
}

function isBlankRow(row) {
  return !row.some((cell) => String(cell || "").trim() !== "");
}

/**
 * @param {string[][]} table              tabla parseada (cabecera + filas)
 * @param {Map<string,string>} existingEmailStates  email normalizado -> etiqueta de estado actual (para marcar duplicados "ya existe en el centro")
 * @param {number} maxRows                límite de filas de datos (excluyendo cabecera y filas en blanco)
 * @returns {{ error: string, expected?: object, max?: number, received?: number } | { rows: Array }}
 */
export function buildImportReview(table, { existingEmailStates = new Map(), maxRows = 500 } = {}) {
  if (!Array.isArray(table) || !table.length) {
    return { error: "empty_file" };
  }

  const [headerRow, ...dataRows] = table;
  const nameIdx = findColumnIndex(headerRow, NAME_HEADER_ALIASES);
  const lastNameIdx = findColumnIndex(headerRow, LAST_NAME_HEADER_ALIASES);
  const emailIdx = findColumnIndex(headerRow, EMAIL_HEADER_ALIASES);

  if (nameIdx === -1 || emailIdx === -1) {
    return {
      error: "columns_not_found",
      expected: { name: NAME_HEADER_ALIASES, email: EMAIL_HEADER_ALIASES },
    };
  }

  const nonBlankRows = dataRows.filter((row) => !isBlankRow(row));
  if (nonBlankRows.length > maxRows) {
    return { error: "too_many_rows", max: maxRows, received: nonBlankRows.length };
  }
  if (!nonBlankRows.length) {
    return { error: "no_data_rows" };
  }

  const seenInFile = new Set();
  const rows = nonBlankRows.map((row) => {
    const rawName = String(row[nameIdx] || "").trim();
    const rawLastName = lastNameIdx !== -1 ? String(row[lastNameIdx] || "").trim() : "";
    const name = [rawName, rawLastName].filter(Boolean).join(" ") || null;
    const email = normalizeEmail(row[emailIdx]);

    let status;
    let reason = null;
    if (!email || !EmailSchema.safeParse(email).success) {
      status = "email_invalido";
      reason = "Email no válido";
    } else if (seenInFile.has(email)) {
      status = "duplicado";
      reason = "Repetido en el propio archivo";
    } else if (existingEmailStates.has(email)) {
      status = "duplicado";
      reason = `Ya existe en el centro (${existingEmailStates.get(email)})`;
    } else {
      status = "listo";
    }
    if (email) seenInFile.add(email);

    return { name, email: email || null, status, reason, selectable: status === "listo" };
  });

  return { rows };
}
