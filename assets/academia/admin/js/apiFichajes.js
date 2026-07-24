// Control horario — en archivo aparte (mismo patrón que apiFinanzas.js/
// apiDocumentos.js) para no seguir engordando api.js.
import { apiFetch } from "../../../shared/js/auth.js";
import { callJson, redirectIfUnauthorized } from "./apiCore.js";

export async function fichar(tipo) {
  const data = await callJson("/api/v1/academia/fichajes/fichar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipo }),
  });
  return data.fichaje;
}

export async function fetchMiEstadoFichaje() {
  return callJson("/api/v1/academia/fichajes/mi-estado");
}

export async function fetchTrabajadoresFichaje() {
  const data = await callJson("/api/v1/academia/fichajes/trabajadores");
  return data.trabajadores || [];
}

export async function fetchFichajes({ worker_profile_id, mes, anio }) {
  const data = await callJson(`/api/v1/academia/fichajes?worker_profile_id=${worker_profile_id}&mes=${mes}&anio=${anio}`);
  return data.fichajes || [];
}

export async function registrarCorreccionFichaje({ worker_profile_id, tipo, fichaje_corregido_id, motivo, notas }) {
  const data = await callJson("/api/v1/academia/fichajes/correccion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worker_profile_id, tipo, fichaje_corregido_id, motivo, notas: notas || null }),
  });
  return data.fichaje;
}

// Descarga directa (no JSON): callJson asume siempre un cuerpo JSON, así
// que aquí se usa apiFetch tal cual — mismo mecanismo de autenticación,
// pero leyendo la respuesta como blob binario (PDF o XLSX).
export async function descargarExportacionFichajes({ worker_profile_id, mes, anio, formato }) {
  const res = await apiFetch(
    `/api/v1/academia/fichajes/exportar?worker_profile_id=${worker_profile_id}&mes=${mes}&anio=${anio}&formato=${formato}`
  );
  if (redirectIfUnauthorized(res)) throw new Error("Sesión caducada.");
  if (!res.ok) throw new Error("No se pudo generar la exportación.");
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const nombreArchivo = match ? match[1] : `control_horario.${formato}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
