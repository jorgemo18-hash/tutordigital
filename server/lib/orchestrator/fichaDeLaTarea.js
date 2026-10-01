// LA HOJA SE PREPARA UNA VEZ, NO UNA VEZ POR ALUMNO (2/10/2026).
//
// Antes, cada alumno que abría una tarea pagaba su propio análisis con Opus
// (detectar los ejercicios y generar los pasos del que elegía), y como la IA
// no contesta igual dos veces, dos alumnos con la misma hoja podían recibir
// pasos distintos. Ahora el análisis se guarda en `tutor_fichas` (migración
// 151) por centro y por HUELLA: el primero que abre la hoja la prepara y los
// demás la leen. Los pasos se guardan por ejercicio, según los va eligiendo
// alguien.
//
// LA HUELLA es lo que determina el análisis: los archivos del enunciado byte
// a byte (no su nombre ni su ruta: la misma hoja subida a dos tareas es la
// misma), el título, la descripción y las notas del profesor, y la versión
// de la guía. Si cambia la guía (modelo o prompt), sube VERSION y todo se
// vuelve a preparar.
//
// ES UN AHORRO, NO UNA DEPENDENCIA: si no se puede calcular la huella, leer o
// escribir la ficha, se analiza como siempre. Nunca deja a un alumno sin
// tutor. Solo se guarda lo que salió bien: una detección fallida no se
// reparte a toda la clase.
import { createHash } from "node:crypto";
import { GUIDE_MODEL } from "../agents/guide.js";

const BUCKET = "task-attachments";
const TABLA = "tutor_fichas";
const VERSION = 1;

const sha256 = (x) => createHash("sha256").update(x).digest("hex");

// Los mismos archivos que lee la guía (buildDocumentBlocks en guide.js): los
// marcados como enunciado y, si no hay ninguno, todos.
export function archivosDelEnunciado(attachments = []) {
  const enunciados = attachments.filter((a) => a.role === "statement");
  return (enunciados.length ? enunciados : attachments).filter((a) => a.storage_path || a.storagePath);
}

export async function huellaDeLaTarea(admin, { title = "", description = "", teacherNotes = "", attachments = [] }) {
  const archivos = archivosDelEnunciado(attachments);
  if (!archivos.length) return null;
  try {
    const partes = [];
    for (const a of archivos) {
      const { data, error } = await admin.storage.from(BUCKET).download(a.storage_path || a.storagePath);
      if (error || !data) return null;
      partes.push(sha256(Buffer.from(await data.arrayBuffer())));
    }
    partes.sort();
    return sha256(JSON.stringify({
      v: VERSION, guia: GUIDE_MODEL, archivos: partes,
      titulo: String(title).trim(), descripcion: String(description).trim(), notas: String(teacherNotes).trim(),
    }));
  } catch {
    return null;
  }
}

export async function leerFicha(admin, { tenantId, huella }) {
  if (!huella) return null;
  try {
    const { data, error } = await admin.from(TABLA).select("ejercicios, texto_documento, pasos")
      .eq("tenant_id", tenantId).eq("huella", huella).maybeSingle();
    return error ? null : data || null;
  } catch {
    return null;
  }
}

// La primera que llega se queda: si dos alumnos la preparan a la vez, las
// dos son válidas y no hace falta pisar ninguna.
export async function guardarEjercicios(admin, { tenantId, huella, ejercicios, textoDocumento }) {
  if (!huella || !Array.isArray(ejercicios) || !ejercicios.length) return;
  try {
    await admin.from(TABLA).upsert(
      { tenant_id: tenantId, huella, ejercicios, texto_documento: textoDocumento || "", pasos: {}, modelo: GUIDE_MODEL },
      { onConflict: "tenant_id,huella", ignoreDuplicates: true },
    );
  } catch { /* es un ahorro: sin ficha, el siguiente alumno analiza */ }
}

export function pasosGuardados(ficha, indice) {
  const pasos = ficha?.pasos?.[String(indice)];
  return Array.isArray(pasos) && pasos.length ? pasos : null;
}

export async function guardarPasos(admin, { tenantId, huella, indice, pasos }) {
  if (!huella || !Array.isArray(pasos) || !pasos.length) return;
  try {
    const ficha = await leerFicha(admin, { tenantId, huella });
    if (!ficha || pasosGuardados(ficha, indice)) return;
    await admin.from(TABLA)
      .update({ pasos: { ...(ficha.pasos || {}), [String(indice)]: pasos }, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId).eq("huella", huella);
  } catch { /* ídem */ }
}
