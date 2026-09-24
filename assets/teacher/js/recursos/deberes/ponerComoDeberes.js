// PONER UNA HOJA COMO DEBERES (paso 3 de Recursos).
//
// Tres pasos, en este orden:
//   1. la hoja está guardada con su código (la pantalla ya lo ha hecho al
//      abrir el diálogo: el código va en el título de la tarea);
//   2. se crea la tarea del grupo, enlazada a la hoja (`hoja_id`, migración
//      131): es lo que permitirá corregirla (paso 4) sabiendo qué se mandó;
//   3. se le adjunta el PDF de la hoja, con su código impreso. Es lo que ve
//      el alumno en su agenda —y lo que recibe el tutor si pide ayuda—,
//      con el mismo camino que cualquier adjunto del profesor.
//
// Si falla el 3, la tarea YA EXISTE: se dice tal cual y se ofrece volver a
// adjuntar el PDF, en vez de crear otra tarea duplicada.
export function blobADataUrl(blob, { Lector = globalThis.FileReader } = {}) {
  return new Promise((resolve, reject) => {
    const r = new Lector();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("No se pudo leer el PDF."));
    r.readAsDataURL(blob);
  });
}

export async function adjuntaElPdf({ api, tareaId, codigo, pedirPdf, aDataUrl = blobADataUrl }) {
  const blob = await pedirPdf();
  const data = await aDataUrl(blob);
  return api.subeAdjunto({ task_id: tareaId, file_name: `Hoja ${codigo}.pdf`, mime: "application/pdf", data });
}

export async function ponerComoDeberes({ api, hoja, datos, pedirPdf, aDataUrl = blobADataUrl }) {
  const tarea = await api.creaTarea({
    group_id: datos.grupoId,
    type: "homework",
    title: datos.titulo.trim().slice(0, 120),
    due_date: datos.entrega || null,
    subject_name: datos.asignatura || undefined,
    teacher_notes: datos.nota?.trim() || undefined,
    hoja_id: hoja.id,
  });
  try {
    await adjuntaElPdf({ api, tareaId: tarea.id, codigo: hoja.codigo, pedirPdf, aDataUrl });
    return { tarea, adjunto: true };
  } catch (err) {
    return { tarea, adjunto: false, error: err?.message || "No se pudo adjuntar el PDF." };
  }
}

// La entrega por defecto: el siguiente día lectivo (mañana, o el lunes si
// mañana es sábado o domingo).
export function siguienteDiaLectivo(hoy = new Date()) {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const dos = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}
