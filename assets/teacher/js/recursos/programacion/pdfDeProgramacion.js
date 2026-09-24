import { apiFetch } from "../../../../shared/js/auth.js";

// Pide el PDF de la programación a la función de Vercel /api/programacion-pdf
// (mismo dominio que el panel, como /api/hoja-pdf). Devuelve un Blob.
export async function pedirPdfDeProgramacion(contenido, { apiFetchFn = apiFetch, origen = globalThis.location?.origin } = {}) {
  const res = await apiFetchFn(`${origen}/api/programacion-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contenido }),
  });
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => ({}));
    throw new Error(cuerpo?.error?.message || "No se pudo generar el PDF.");
  }
  return res.blob();
}
