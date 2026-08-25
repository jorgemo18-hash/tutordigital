// Cliente genérico para los endpoints de tutordigital-pdf-service que
// devuelven el PDF en bytes. Sin acoplar Sentry aquí a propósito — cada
// llamador (generarPdfs.js) captura su propio evento con un mensaje
// distinguible, porque un mensaje genérico compartido agrupaba en Sentry
// fallos que en realidad eran de PDFs distintos (lección ya aprendida en
// este repo, ver comentario de generarHojaInscripcion.js).
//
// Tres reglas de reintento, cada una por un fallo observado en producción:
//
// 1. TIMEOUT POR INTENTO. `fetch` sin señal usa el default de undici
//    (300 s de headersTimeout). Con reintentos encadenados, un servicio
//    colgado podía bloquear una petición durante ~25 minutos mientras el
//    proxy de Render ya había cortado por arriba: el navegador recibía un
//    502 y el servidor seguía trabajando, así que reintentar desde la UI
//    mandaba el email dos veces.
//
// 2. NO REINTENTAR LO QUE NO VA A CAMBIAR. Antes se reintentaba ante
//    cualquier respuesta no-ok, incluido un 400 por payload malformado:
//    cinco intentos para un error determinista. Ahora solo se reintentan
//    los fallos de red, los 5xx, y los 408/425/429 (el plan gratuito de
//    Render responde 429 cuando el servicio lleva un rato dormido).
//
// 3. PRESUPUESTO TOTAL ACOTADO. Un cold start de Render puede tardar
//    minutos (medido: hasta 3,5 min seguidos de 502). Eso NO se puede
//    cubrir dentro de una petición del navegador — el proxy corta mucho
//    antes—, así que en vez de esperar en balde se falla pronto y con un
//    código que la interfaz puede traducir a "el servicio estaba dormido,
//    reinténtalo en un momento". La solución de fondo a los cold starts es
//    el plan de pago del microservicio, no un presupuesto más largo aquí.
const TIMEOUT_POR_INTENTO_MS = 45000;
const PRESUPUESTO_TOTAL_MS = 90000;
// Escalonadas en vez de 10 s fijos: un servicio que solo tropezó responde
// al segundo intento sin castigar al usuario con 10 s, y uno que está
// arrancando recibe esperas cada vez más largas sin multiplicar intentos.
const ESPERAS_MS = [2000, 5000, 10000, 20000];

const STATUS_REINTENTABLES = new Set([408, 425, 429]);

function esReintentable(resultado) {
  if (resultado.code === "pdf_service_unreachable") return true;
  if (resultado.code === "pdf_service_timeout") return true;
  const status = resultado.pdfServiceStatus;
  if (typeof status !== "number") return false;
  return status >= 500 || STATUS_REINTENTABLES.has(status);
}

async function intentarUnaVez(pdfServiceUrl, path, payload, timeoutMs) {
  const controller = new AbortController();
  const temporizador = setTimeout(() => controller.abort(), timeoutMs);
  let resp;
  try {
    resp = await fetch(`${pdfServiceUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    // Distinguir "he cortado yo por timeout" de "no hay nadie al otro lado"
    // — el motivo que ve el usuario es distinto y la causa a investigar
    // también.
    if (err?.name === "AbortError") {
      return {
        ok: false,
        code: "pdf_service_timeout",
        motivo: "El servicio de generación de PDF tardó demasiado en responder.",
      };
    }
    return {
      ok: false,
      code: "pdf_service_unreachable",
      motivo: "No se pudo contactar con el servicio de generación de PDF.",
    };
  } finally {
    clearTimeout(temporizador);
  }

  if (!resp.ok) {
    // Texto crudo primero — un 502 del proxy de Render en cold start no es
    // JSON, y con solo .json().catch(()=>({})) esa respuesta se perdía
    // entera.
    const pdfServiceBody = await resp.text().catch(() => "");
    let parsed = {};
    try { parsed = JSON.parse(pdfServiceBody); } catch {}
    return {
      ok: false,
      code: "pdf_service_failed",
      motivo: parsed.error || "El servicio de PDF devolvió un error.",
      pdfServiceStatus: resp.status,
      pdfServiceBody,
    };
  }

  try {
    return { ok: true, buffer: Buffer.from(await resp.arrayBuffer()) };
  } catch {
    // La respuesta empezó bien pero se cortó a mitad de la descarga: es un
    // fallo de red, no del servicio, y merece reintento como tal.
    return {
      ok: false,
      code: "pdf_service_unreachable",
      motivo: "La descarga del PDF se interrumpió.",
    };
  }
}

// `ahora` inyectable para poder probar el agotamiento del presupuesto sin
// esperar en tiempo real (CLAUDE.md: dependencias explícitas, nunca cierre
// sobre el scope padre).
export async function fetchPdfBuffer(
  pdfServiceUrl,
  path,
  payload,
  {
    timeoutPorIntentoMs = TIMEOUT_POR_INTENTO_MS,
    presupuestoTotalMs = PRESUPUESTO_TOTAL_MS,
    esperasMs = ESPERAS_MS,
    ahora = () => Date.now(),
    dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {}
) {
  const inicio = ahora();
  let resultado = await intentarUnaVez(pdfServiceUrl, path, payload, timeoutPorIntentoMs);

  for (const espera of esperasMs) {
    if (resultado.ok || !esReintentable(resultado)) break;
    // No empezar un intento que no cabe en el presupuesto: dejar al usuario
    // esperando para luego abandonar igual es lo peor de las dos opciones.
    const consumido = ahora() - inicio;
    if (consumido + espera + timeoutPorIntentoMs > presupuestoTotalMs) break;

    await dormir(espera);
    resultado = await intentarUnaVez(pdfServiceUrl, path, payload, timeoutPorIntentoMs);
  }

  return resultado;
}
