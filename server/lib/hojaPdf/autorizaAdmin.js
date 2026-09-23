// ¿QUIEN PIDE EL PDF ES ADMIN DE UN CENTRO? Se pregunta a la API de siempre.
//
// La función de PDF vive en Vercel, no en el servidor de la API, y no
// repite la comprobación de sesión y de rol: la delega. Pide el catálogo del
// generador (que solo da la API a un admin del centro) con las mismas
// cabeceras que trae la petición. Si la API dice que sí, es admin; si no, no.
// Así solo hay UN sitio donde se decide quién puede usar el generador.
//
// `fetchFn` y `apiBase` se inyectan para los tests.
export async function autorizaAdmin({ cabeceras, apiBase, fetchFn = fetch }) {
  const autorizacion = cabeceras.authorization || cabeceras.Authorization;
  const centro = cabeceras["x-ttd-tenant"];
  if (!autorizacion || !centro) return { ok: false, status: 401 };
  try {
    const res = await fetchFn(`${apiBase}/api/v1/academia/hojas-ejercicios/catalogo`, {
      headers: { Authorization: autorizacion, "x-ttd-tenant": centro },
    });
    return res.ok ? { ok: true } : { ok: false, status: res.status === 401 ? 401 : 403 };
  } catch {
    return { ok: false, status: 503 };
  }
}
