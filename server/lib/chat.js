import Anthropic from "@anthropic-ai/sdk";
import * as mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { z } from "zod";

function isValidBase64(input = "") {
  const cleaned = String(input || "").replace(/\s/g, "");
  if (!cleaned) return false;
  if (!/^[A-Za-z0-9+/=]+$/.test(cleaned)) return false;
  if (cleaned.length % 4 !== 0) return false;
  if (/={3,}$/.test(cleaned)) return false;
  return true;
}

function getBase64FromMaybeDataUrl(input = "") {
  const s = String(input || "").trim();
  if (!s) return null;

  const idx = s.indexOf("base64,");
  if (idx !== -1) {
    const b64 = s.slice(idx + "base64,".length).replace(/\s/g, "");
    return isValidBase64(b64) ? b64 : null;
  }

  const cleaned = s.replace(/\s/g, "");
  if (isValidBase64(cleaned)) return cleaned;
  return null;
}

function approxBase64Bytes(base64 = "") {
  const s = String(base64 || "");
  let padding = 0;
  if (s.endsWith("==")) padding = 2;
  else if (s.endsWith("=")) padding = 1;
  return Math.max(0, Math.floor((s.length * 3) / 4) - padding);
}

function truncateText(input = "", max = 120_000) {
  const t = String(input || "");
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n[...contenido truncado...]`;
}

const MAX_TEXT_CHARS = 5000;
const MAX_FILENAME_CHARS = 120;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED_FILE_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_MODES = new Set(["deberes", "examen", "examenes", "trabajo"]);

function normalizeModeKey(mode = "") {
  return String(mode || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeTutorMode(mode = "") {
  const m = String(mode || "").trim().toUpperCase();
  if (m === "DEBERES") return "deberes";
  if (m === "EXAMEN") return "examen";
  if (m === "TRABAJO") return "trabajo";

  const low = normalizeModeKey(mode);
  if (low === "deberes") return "deberes";
  if (low === "examen" || low === "examenes") return "examen";
  if (low === "trabajo") return "trabajo";
  return "deberes";
}

function buildTutorInstructions(modo, taskContext, attemptsSameError, sesion) {
  const systemPromptBase = `Eres TutorDigital, un tutor académico para alumnado de 4º de Primaria hasta 2º de Bachillerato del sistema educativo español.

Tu objetivo principal NO es dar respuestas ni resolver tareas. Es ayudar al estudiante a comprender, pensar y avanzar paso a paso hasta llegar por sí mismo a la solución.

Al inicio de cada conversación recibirás un bloque de contexto con el nombre del alumno, su nivel, curso, asignatura, modo y otros datos de sesión. Úsalos para personalizar cada respuesta. Nunca le preguntes información que ya tienes en ese bloque.

## MISIÓN PEDAGÓGICA

- Guía hacia el siguiente paso correcto, no al resultado final.
- Prioriza comprensión, autonomía y razonamiento sobre rapidez.
- Corrige sin humillar. Exige sin ser seco.
- Adapta lenguaje, profundidad y tono al nivel educativo del estudiante.
- Nunca hagas el trabajo por él.

## REGLAS DURAS

1. No des la respuesta final de un ejercicio evaluable, deber, problema, redacción o comentario de texto, salvo que el modo de sesión lo autorice explícitamente.
2. No completes tareas enteras para copiar.
3. No valides una respuesta con "sí, está bien" sin pedir antes justificación o explicación breve.
4. Haz solo UNA pregunta principal por turno. Nunca dos a la vez.
5. No avances al siguiente paso hasta que el estudiante responda al actual, salvo que esté claramente bloqueado.
6. Si el estudiante pide "dime la respuesta", "hazlo tú" o variantes: mantén el modo socrático. No cedas.
7. Si detectas falta de esfuerzo repetida: no escales más pistas. Haz zoom out: vuelve a la base conceptual y pregunta exactamente qué parte no entiende.
8. Si el estudiante cometió un error: no corrijas directamente. Pídele que explique cómo llegó ahí e identifica con él el paso donde se desvió.
9. Si el estudiante cree haber terminado: no valides sin pedir primero una justificación o comprobación breve.
10. Si la petición sale del ámbito académico o no es apropiada para menores: redirige con prudencia y sin entrar en el tema.

## EXCEPCIÓN: CONOCIMIENTO DECLARATIVO

Si la petición es puramente factual y no descomponible en pasos razonables (una fecha, una definición breve, una fórmula exacta, una convención), puedes dar el dato directamente. Aun así:
- Da el dato con claridad.
- Añade una mini-explicación de por qué es así.
- Comprueba después si sabe usarlo en contexto.

## DETECCIÓN DE ABUSO DE AYUDA

Señales: pide repetidamente más ayuda sin intentar nada, responde "no sé" varias veces sin esfuerzo real, ignora preguntas diagnósticas, solo busca copiar la solución.

Ante eso, no escales más pistas. En su lugar:
- Da un paso atrás.
- Pregunta qué parte exacta no entiende.
- Reduce el problema a una decisión concreta o a elegir entre pocas opciones.

## ESCALADO DE AYUDA

Sigue este orden estrictamente. No saltes niveles salvo causa clara:

- Nivel 1. Pregunta diagnóstica breve.
- Nivel 2. Pista mínima conceptual (no procedimental).
- Nivel 3. Reencuadre del problema o división en una parte más pequeña.
- Nivel 4. Explicación conceptual breve del tipo de error o del método, sin dar la solución.
- Nivel 5. Si el estudiante lleva 4 o más turnos sin avanzar, o comete el mismo error 3 veces seguidas, emite la señal de escalado al profesor (ver sección ESCALADO AL PROFESOR).

## MANEJO DE ERRORES

Antes de responder a cualquier paso del alumno, comprueba si es correcto comparándolo con el paso anterior y con la ecuación original. Si hay un error, señálalo antes de hacer cualquier pregunta. No avances ni hagas preguntas de progreso si el paso está mal.

Cuando el estudiante se equivoque:
- Di explícitamente que hay un error. No lo dejes pasar.
- Identifica el tipo de error en lenguaje natural: conceptual, de signo, de operación, de cálculo.
- Haz UNA pregunta que le lleve a descubrir el error por sí mismo. Nada más.
- No expliques el procedimiento correcto. No digas qué operación debe hacer. No digas hacia dónde va el término. Solo pregunta.

Ejemplo de error frecuente — cambio de lado sin cambiar signo:
Alumno tiene: 2x + 5 = 8
Alumno escribe: 2x = 8 + 5
Respuesta CORRECTA del tutor: "Ese paso tiene un error de signo. Cuando un término cambia de lado en una ecuación, algo le ocurre a su signo. ¿Qué crees que debería pasarle al +5?"
Respuesta INCORRECTA del tutor: "El +5 que estaba sumando debe pasar restando al lado derecho." ← esto es dar la solución, nunca hagas esto.

Si el alumno comete el mismo error dos veces seguidas en el mismo ejercicio:
- No repitas la misma explicación.
- Da un paso atrás: pregunta por el concepto más básico que hay detrás del error.
- Ejemplo: "Llevamos dos veces con el mismo punto. Antes de seguir con la ecuación: cuando tienes A + B = C y quieres pasar B al otro lado, ¿qué regla se aplica siempre?"

Nunca digas qué operación debe hacer el alumno ni hacia dónde debe mover un término. Solo pregunta.

## GESTIÓN DEL EJERCICIO ACTIVO

Cuando el alumno envía por primera vez un ejercicio o problema concreto, ese ejercicio se convierte en el ejercicio activo de la sesión. Memorízalo exactamente como lo escribió el alumno.

Mientras el ejercicio activo no haya terminado, interpreta TODOS los mensajes siguientes como pasos o intentos del alumno sobre ese mismo ejercicio. No los trates como ejercicios nuevos aunque parezcan ecuaciones o expresiones independientes.

Ejemplo:
- Alumno escribe: 2x + 5 = 8  → ejercicio activo establecido
- Alumno escribe: 2x = 8 + 5  → es un intento (incorrecto) sobre el mismo ejercicio, no una ecuación nueva
- Alumno escribe: 2x = 13     → es otro intento (también incorrecto) sobre el mismo ejercicio
- Alumno escribe: 2x = 3      → es un intento correcto, confirmar y pasar al siguiente paso

Si en algún momento no estás seguro de si el alumno está continuando el ejercicio activo o planteando uno nuevo, pregúntale explícitamente: "¿Estás siguiendo con la ecuación anterior o es un ejercicio nuevo?"

El ejercicio activo termina cuando ocurre una de estas tres cosas:
1. El alumno llega a la solución correcta y la verifica.
2. Se emite la señal [ESCALAR_PROFESOR] por bloqueo sostenido.
3. El alumno dice explícitamente que quiere cambiar de ejercicio.

Hasta que ocurra una de esas tres cosas, no des por terminado el ejercicio activo ni empieces uno nuevo.

## VERIFICACIÓN DE COMPRENSIÓN

Cuando el estudiante llegue a una respuesta correcta, no cierres con "muy bien". Pide una comprobación breve:
- "Explícamelo con tus palabras."
- "¿Por qué ese paso sí y el anterior no?"
- "¿Cómo se lo explicarías a un compañero?"
- "Haz ahora uno parecido con valores distintos."

## ADAPTACIÓN POR NIVEL EDUCATIVO

### Primaria (4º–6º)
- Frases muy cortas. Vocabulario cotidiano.
- Preguntas muy concretas y observables.
- Sin abstracción innecesaria.
- Refuerza avances pequeños sin exagerar.
- Máximo 2–3 frases por respuesta.

### ESO (1º–4º)
- Vocabulario académico sencillo, definiendo términos cuando aparezcan.
- Tono cercano, no infantil.
- Preguntas de razonamiento simples con ejemplos cotidianos.
- Máximo 3–5 frases por respuesta.

### Bachillerato (1º–2º)
- Lenguaje preciso y riguroso.
- Razonamiento analítico, matices, contraste de ideas.
- Trata al estudiante como alguien capaz.
- No simplifiques de forma condescendiente.
- Respuestas breves pero intelectualmente exigentes.

## ADAPTACIÓN POR MODO DE SESIÓN

### Modo DEBERES
- Permite andamiaje gradual.
- Prioriza comprensión y práctica guiada.
- Puedes dar pistas operativas pequeñas, pero nunca resolver entero.
- Nunca des la respuesta final, aunque el alumno insista.

### Modo EXAMEN
- Máxima prudencia. No des respuestas finales. Nunca.
- No hagas desarrollos que el estudiante pueda copiar.
- Limítate a preguntas de activación, revisión del razonamiento y detección de errores conceptuales.
- Puedes indicar en qué parte o concepto está el error, pero no el valor exacto.

### Modo TRABAJO
- Permite exploración, organización y estructuración de ideas.
- Ayuda a ordenar ideas, planificar, resumir y mejorar la estructura, no el contenido final.
- No redactes partes del trabajo. No generes texto para copiar.
- Preguntas útiles: "¿Cuál es la tesis que quieres defender?", "¿Has pensado en organizar esto por [criterio]?", "¿Qué fuentes has consultado ya?"

## CUANDO HAYA VARIOS EJERCICIOS

Si el estudiante sube una foto o documento con varios ejercicios:
- No resuelvas varios a la vez.
- Pídele que elija uno concreto.
- Pregunta cuál quiere trabajar primero.

## CUANDO HAYA MATERIAL ADJUNTO

Si hay apuntes, PDF, imagen o documento:
- Usa ese material como referencia principal.
- Cita o menciona el fragmento relevante si procede.
- Si algo no aparece en el material, dilo claramente.
- No inventes contenido que no esté en el documento.

## DETECCIÓN DE COPIA DE EXAMEN

Si el alumno envía un enunciado completo y detallado sin ningún intento propio y con indicios de urgencia (posible examen en curso):
- Activa automáticamente modo solo-pistas.
- Ofrece un ejercicio isomorfo: mismo concepto, valores distintos.
- Ejemplo: "Para poder ayudarte necesito que me cuentes qué has intentado primero. Mientras tanto, practica con este ejercicio similar: [ejercicio isomorfo]."

## ESTILO DE RESPUESTA

Escribe de forma natural, como lo haría un buen profesor en persona. No uses etiquetas, letras ni encabezados tipo "A)", "B)", "C)". No estructures cada respuesta con el mismo esquema fijo.

Lo que sí debe ocurrir en cada respuesta, pero de forma fluida:
- Reacciona a lo que el alumno acaba de escribir. Si se equivocó, díselo con claridad y sin rodeos. Si avanzó bien, confírmalo brevemente y sigue.
- Haz una sola pregunta o da un solo paso siguiente. Nunca dos a la vez.
- Cuando el alumno cometa un error, identifica el tipo de error en lenguaje natural, no con listas. Ejemplo: "Aquí hay un problema: estás sumando cuando deberías multiplicar. ¿Recuerdas por qué?"
- Cuando el alumno acierte, díselo sin exagerar y llévale al siguiente paso.

Varía el tono y la estructura entre turnos. No empieces todas las respuestas igual. Una respuesta puede ser de dos frases. Otra puede tener una pista. Otra puede ser solo una pregunta directa. Lo que no puede faltar es claridad sobre si el alumno va bien o mal.

## TONO

- Paciente, claro y firme.
- Cercano pero no infantil.
- Exigente sin ser seco.
- Nunca sarcástico.
- Nunca paternalista.
- Nunca premies el mínimo esfuerzo como si fuera una hazaña.

## HONESTIDAD Y SEGURIDAD

- Si no tienes suficiente contexto, pídelo.
- Si el enunciado está incompleto o la imagen no se entiende, dilo.
- Si no puedes verificar algo, no lo inventes.
- Si la petición sale del ámbito académico o no es segura para menores, redirige con prudencia.

## ESCALADO AL PROFESOR

Cuando se cumpla cualquiera de estas condiciones:
- El estudiante comete el mismo error 3 veces seguidas.
- El estudiante lleva 4 o más turnos sin avanzar.
- El estudiante pide la respuesta directa más de 2 veces.
- Las pistas de Nivel 4 no han funcionado.

Escribe en la última línea de tu respuesta, sin texto después:
[ESCALAR_PROFESOR: motivo en una frase]

Ejemplo: [ESCALAR_PROFESOR: El alumno no comprende el concepto de despeje con cambio de signo tras 3 intentos fallidos.]

El backend eliminará esta etiqueta del texto visible y notificará al profesor. No le digas al alumno que estás escalando. Simplemente dile que el profesor puede ayudarle con esto y que puede seguir practicando con el ejercicio isomorfo.

---

Tu criterio general:
AYUDAR A PENSAR > DAR RESPUESTAS
PROGRESO REAL > VELOCIDAD
AUTONOMÍA > DEPENDENCIA`;

  const contextoSesion = `

CONTEXTO DE SESIÓN:
- alumno_nombre: ${(sesion && sesion.alumno_nombre) || 'el alumno'}
- nivel_educativo: ${(sesion && sesion.nivel_educativo) || 'ESO'}
- curso: ${(sesion && sesion.curso) || 'no especificado'}
- asignatura: ${(sesion && sesion.asignatura) || (taskContext && taskContext.subject) || 'no especificada'}
- modo: ${(modo && modo.toUpperCase()) || 'DEBERES'}
- tarea_titulo: ${(taskContext && taskContext.title) || 'sin título'}
- tarea_descripcion: ${(taskContext && taskContext.description) || 'sin descripción adicional'}
- intentos_mismo_error: ${attemptsSameError || 0}
- hay_archivo_adjunto: ${(sesion && sesion.hay_archivo_adjunto) || false}
- tipo_archivo: ${(sesion && sesion.tipo_archivo) || 'ninguno'}
- material_curricular_disponible: false
- profesor_disponible: true`;

  return systemPromptBase + contextoSesion;
}

function procesarRespuestaTutor(respuesta, sesionInfo) {
  const regexEscalado = /\[ESCALAR_PROFESOR:\s*(.+?)\]/;
  const match = respuesta.match(regexEscalado);

  if (match) {
    const motivo = match[1].trim();
    const respuestaLimpia = respuesta.replace(regexEscalado, '').trim();

    // TODO: conectar a Supabase cuando implementemos la vista del profesor
    console.log('[ESCALADO AL PROFESOR]', {
      alumno: (sesionInfo && sesionInfo.alumno_nombre) || 'desconocido',
      asignatura: (sesionInfo && sesionInfo.asignatura) || 'desconocida',
      tarea: (sesionInfo && sesionInfo.tarea_titulo) || 'sin título',
      motivo,
      timestamp: new Date().toISOString()
    });

    return respuestaLimpia;
  }

  return respuesta;
}

const ChatSchema = z
  .object({
    text: z.string().max(MAX_TEXT_CHARS).optional(),
    mode: z.string().max(40).optional(),
    model: z.string().max(80).optional(),
    temperature: z.number().min(0).max(2).optional(),
    attemptsSameError: z.number().int().min(0).max(10).optional(),
    image: z.string().optional(),
    imageDataUrl: z.string().optional(),
    fileDataUrl: z.string().optional(),
    fileDataURL: z.string().optional(),
    fileName: z.string().max(MAX_FILENAME_CHARS).optional(),
    filename: z.string().max(MAX_FILENAME_CHARS).optional(),
    fileMime: z.string().optional(),
    mime: z.string().optional(),
    file: z
      .object({
        dataUrl: z.string(),
        name: z.string().max(MAX_FILENAME_CHARS).optional(),
        mime: z.string().optional(),
      })
      .optional(),
    messages: z
      .array(
        z.object({
          role: z.string().max(20),
          content: z.string().max(2000),
        })
      )
      .max(60)
      .optional(),
    taskContext: z
      .object({
        title: z.string().max(300).optional(),
        description: z.string().max(1000).optional(),
      })
      .optional(),
  })
  .passthrough();

export function validateChatBody(rawBody = {}) {
  const parsed = ChatSchema.safeParse(rawBody || {});
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      code: "invalid_body",
      message: "Petición no válida.",
      issues: parsed.error.issues,
    };
  }

  const body = parsed.data;
  const text = String(body.text || "").trim();
  const mode = String(body.mode || "").trim();

  const imageDataUrl = body.image || body.imageDataUrl || null;

  const fileDataUrl = body.file?.dataUrl || body.fileDataUrl || body.fileDataURL || null;
  const fileName = body.file?.name || body.fileName || body.filename || "";
  let fileMime = body.file?.mime || body.fileMime || body.mime || "";

  if (fileDataUrl) {
    const base64 = getBase64FromMaybeDataUrl(fileDataUrl);
    if (!base64) {
      return {
        ok: false,
        status: 400,
        code: "invalid_base64",
        message: "No he podido leer el archivo. Vuelve a guardarlo e inténtalo de nuevo.",
      };
    }

    const approxBytes = approxBase64Bytes(base64);
    if (approxBytes > MAX_FILE_BYTES) {
      return {
        ok: false,
        status: 413,
        code: "payload_too_large",
        message: "El archivo es demasiado grande. Prueba con uno más pequeño.",
      };
    }

    if (!fileMime) {
      const lower = String(fileName || "").toLowerCase();
      const ext = lower.includes(".") ? lower.split(".").pop() : "";
      if (ext === "pdf") fileMime = "application/pdf";
      else if (ext === "docx") fileMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }

    if (!fileMime || !ALLOWED_FILE_MIMES.has(fileMime)) {
      return {
        ok: false,
        status: 415,
        code: "unsupported_mime",
        message: "Tipo de archivo no soportado.",
      };
    }
  }

  if (imageDataUrl) {
    const imageBase64 = getBase64FromMaybeDataUrl(imageDataUrl);
    if (!imageBase64) {
      return {
        ok: false,
        status: 400,
        code: "invalid_image",
        message: "No he podido leer la imagen. Prueba a reenviarla.",
      };
    }

    const approxBytes = approxBase64Bytes(imageBase64);
    if (approxBytes > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        status: 413,
        code: "payload_too_large",
        message: "La imagen es demasiado grande. Prueba con una más pequeña.",
      };
    }

    if (String(imageDataUrl).startsWith("data:") && !/^data:image\//i.test(String(imageDataUrl))) {
      return {
        ok: false,
        status: 415,
        code: "unsupported_mime",
        message: "Tipo de imagen no soportado.",
      };
    }
  }

  if (mode) {
    const modeKey = normalizeModeKey(mode);
    if (!ALLOWED_MODES.has(modeKey) && !["DEBERES", "EXAMEN", "TRABAJO"].includes(String(mode).toUpperCase())) {
      return {
        ok: false,
        status: 400,
        code: "invalid_mode",
        message: "Modo no válido.",
      };
    }
  }

  const hasMessages = Array.isArray(body.messages) && body.messages.length > 0;
  if (!text && !imageDataUrl && !fileDataUrl && !hasMessages) {
    return {
      ok: false,
      status: 400,
      code: "missing_text_or_file",
      message: "Falta texto o adjunto.",
    };
  }

  return {
    ok: true,
    data: {
      text,
      mode,
      model: body.model || "",
      temperature: Number.isFinite(body.temperature) ? Number(body.temperature) : null,
      attemptsSameError: Number.isFinite(body.attemptsSameError) ? Number(body.attemptsSameError) : null,
      imageDataUrl,
      fileDataUrl,
      fileName,
      fileMime,
      messages: Array.isArray(body.messages) ? body.messages : [],
    },
  };
}

function userFacingMessage(status, code) {
  if (status === 401) return "Error de autenticación con el proveedor. Avísanos (ID incluido).";
  if (status === 413) return "El archivo es demasiado grande. Prueba con uno más pequeño.";
  if (status === 429) return "Ahora mismo hay demasiadas peticiones. Prueba en unos segundos.";
  if (status >= 500) return "Ha ocurrido un error al procesar tu petición.";
  if (code === "invalid_request_error") return "Petición no válida. Revisa el archivo o el texto.";
  return "No he podido procesar tu petición.";
}

async function extractFileContent(fileDataUrl, fileName = "", fileMime = "") {
  if (!fileDataUrl) return [];

  const filenameRaw = String(fileName || "archivo");
  const safeName = filenameRaw.replace(/[\/\\]/g, "_").slice(0, MAX_FILENAME_CHARS);
  const mimeRaw = String(fileMime || "");
  const lower = safeName.toLowerCase();
  const ext = lower.includes(".") ? lower.split(".").pop() : "";

  const isPDF = mimeRaw === "application/pdf" || (!mimeRaw && ext === "pdf");
  const isDocx =
    mimeRaw === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    (!mimeRaw && ext === "docx");

  if (!isPDF && !isDocx) {
    return [];
  }

  const base64 = getBase64FromMaybeDataUrl(fileDataUrl);
  if (!base64) return [];

  const buf = Buffer.from(base64, "base64");
  const content = [];

  if (isDocx) {
    let extracted = "";
    try {
      const result = await mammoth.extractRawText({ buffer: buf });
      extracted = String(result?.value || "").replace(/\r/g, "").trim();
    } catch {}

    if (extracted) {
      content.push({
        type: "text",
        text: `Contenido del Word (${safeName}):\n\n${truncateText(extracted)}`,
      });
    }
  }

  if (isPDF) {
    let extractedPdf = "";
    try {
      const result = await pdfParse(buf);
      extractedPdf = String(result?.text || "").replace(/\r/g, "").trim();
    } catch {}

    if (extractedPdf) {
      content.push({
        type: "text",
        text: `Contenido del PDF (${safeName}):\n\n${truncateText(extractedPdf)}`,
      });
    }
  }

  return content;
}

async function verificarPasoMatematico(client, model, historial, mensajeActual) {
  try {
    const mensajesUsuario = historial.filter(m => m.role === 'user');

    if (mensajesUsuario.length < 2) return 'NO_MATEMATICO';

    const ejercicioOriginal = mensajesUsuario[0].content;
    const pasoAnterior = mensajesUsuario[mensajesUsuario.length - 2]?.content || '';

    const prompt = `Eres un verificador matemático estricto. Analiza si el último paso del alumno es matemáticamente correcto dado el ejercicio original.

Ejercicio original: ${ejercicioOriginal}
Paso anterior del alumno: ${pasoAnterior}
Último paso del alumno: ${mensajeActual}

Reglas:
- Cuando un término cambia de lado en una ecuación, DEBE cambiar de signo. Si no lo hace, es INCORRECTO.
- Verifica el paso actual contra el ejercicio original y el paso anterior.
- Si el mensaje no contiene una expresión matemática verificable, responde NO_MATEMATICO.

Responde ÚNICAMENTE con una palabra: CORRECTO, INCORRECTO o NO_MATEMATICO.`;

    const res = await client.messages.create({
      model,
      max_tokens: 10,
      messages: [{ role: 'user', content: prompt }]
    });

    const resultado = res.content[0].text.trim().toUpperCase();
    if (['CORRECTO', 'INCORRECTO', 'NO_MATEMATICO'].includes(resultado)) {
      return resultado;
    }
    return 'NO_MATEMATICO';
  } catch (e) {
    return 'NO_MATEMATICO';
  }
}

export async function askAnthropicChat(validatedData = {}, { apiKey = "", defaultModel = "claude-sonnet-4-5" } = {}) {
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      code: "missing_anthropic_key",
      message: "Falta configuración del proveedor de IA.",
    };
  }

  const client = new Anthropic({ apiKey });
  const text = String(validatedData.text || "");
  const mode = String(validatedData.mode || "");
  const model = String(validatedData.model || "").trim() || defaultModel;

  const content = [];
  const fileContent = await extractFileContent(
    validatedData.fileDataUrl,
    validatedData.fileName,
    validatedData.fileMime
  );
  content.push(...fileContent);

  if (validatedData.imageDataUrl) {
    const imgDataUrl = String(validatedData.imageDataUrl);
    const imgBase64 = getBase64FromMaybeDataUrl(imgDataUrl);
    let mediaType = "image/jpeg";
    if (imgDataUrl.startsWith("data:")) {
      const match = imgDataUrl.match(/^data:(image\/[^;]+);/);
      if (match) mediaType = match[1];
    }
    if (imgBase64) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data: imgBase64 },
      });
    }
  }

  const cleanedText = String(text || "").trim();
  const hasUserText = cleanedText.length > 0;
  const hasAttachment = Boolean(validatedData.fileDataUrl || validatedData.imageDataUrl);

  const fallbackText = hasAttachment
    ? `He recibido un adjunto. Dime el ejercicio exacto (número/página/apartado) y el primer paso que has intentado.`
    : "¿Qué necesitas exactamente y en qué curso estás?";

  content.push({
    type: "text",
    text: hasUserText ? cleanedText : fallbackText,
  });

  const messages = [];

  if (Array.isArray(validatedData.messages) && validatedData.messages.length > 0) {
    const historial = validatedData.messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
      .map((m) => ({
        role: m.role,
        content: m.content.trim()
      }));

    // Anthropic exige que el array empiece siempre por 'user' y alterne roles
    // Si el primer mensaje es 'assistant', lo descartamos
    while (historial.length > 0 && historial[0].role !== 'user') {
      historial.shift();
    }

    // Eliminar turnos consecutivos del mismo rol (no válido en Anthropic)
    const historialLimpio = [];
    for (const mensaje of historial) {
      if (historialLimpio.length === 0 || historialLimpio[historialLimpio.length - 1].role !== mensaje.role) {
        historialLimpio.push(mensaje);
      }
    }

    // Limitar a los últimos 20 turnos para controlar tokens
    const historialRecortado = historialLimpio.slice(-20);

    messages.push(...historialRecortado);
  }

  // El mensaje actual del alumno siempre va al final
  messages.push({ role: 'user', content });

  const system = buildTutorInstructions(mode, validatedData.taskContext || null, validatedData.attemptsSameError, null);

  const verificacion = await verificarPasoMatematico(
    client,
    model,
    messages,
    cleanedText
  );

  let notaVerificacion = '';
  if (verificacion === 'INCORRECTO') {
    notaVerificacion = '\n\n[VERIFICACIÓN INTERNA: El paso del alumno es matemáticamente INCORRECTO. Señala el error sin dar la solución. No avances.]';
  } else if (verificacion === 'CORRECTO') {
    notaVerificacion = '\n\n[VERIFICACIÓN INTERNA: El paso del alumno es matemáticamente CORRECTO. Confírmalo y guía al siguiente paso.]';
  }

  const systemFinal = system + notaVerificacion;

  const req = {
    model,
    system: systemFinal,
    messages,
    max_tokens: 600,
  };

  if (Number.isFinite(validatedData.temperature)) {
    req.temperature = validatedData.temperature;
  }

  try {
    const response = await client.messages.create(req);
    const textoRespuesta = procesarRespuestaTutor(
      response.content[0].text,
      null
    );
    return {
      ok: true,
      data: {
        reply: textoRespuesta,
        usage: response?.usage || null,
        model,
      },
    };
  } catch (err) {
    const status = err?.status || 500;
    const code = err?.error?.type || err?.code || "unknown";
    return {
      ok: false,
      status,
      code,
      message: userFacingMessage(status, code),
      meta: {
        providerStatus: status,
        providerType: code,
      },
    };
  }
}
