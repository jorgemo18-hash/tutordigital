// ¿QUIEN PIDE EL PDF PUEDE USAR EL GENERADOR? Se pregunta a la API de siempre.
//
// La función de PDF vive en Vercel, no en el servidor de la API, y no
// repite la comprobación de sesión y de rol: la delega. Pide el catálogo del
// generador con las mismas cabeceras que trae la petición. Si la API dice
// que sí, puede; si no, no. Así solo hay UN sitio donde se decide quién puede
// usar el generador.
//
// Se pregunta a /recursos/hojas (profesor y admin), no a la ruta de la
// academia (solo admin): el PDF lo piden los dos paneles, y el más amplio de
// los dos es el que decide. Un profesor de instituto no pasaría por la de la
// academia aunque tenga todo el derecho a imprimir su hoja.
//
// `fetchFn` y `apiBase` se inyectan para los tests.
export async function autorizaGenerador({ cabeceras, apiBase, fetchFn = fetch }) {
  const autorizacion = cabeceras.authorization || cabeceras.Authorization;
  const centro = cabeceras["x-ttd-tenant"];
  if (!autorizacion || !centro) return { ok: false, status: 401 };
  try {
    const res = await fetchFn(`${apiBase}/api/v1/recursos/hojas/catalogo`, {
      headers: { Authorization: autorizacion, "x-ttd-tenant": centro },
    });
    return res.ok ? { ok: true } : { ok: false, status: res.status === 401 ? 401 : 403 };
  } catch {
    return { ok: false, status: 503 };
  }
}
