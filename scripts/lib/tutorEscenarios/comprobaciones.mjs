// LO QUE SE COMPRUEBA SIN IA: reglas que un programa puede mirar solo.
//
// Son las reglas del prompt que se pueden contar (una pregunta, 3-4 líneas,
// sin listas) y lo que dice cada escenario (qué no puede aparecer, si tiene
// que marcar el paso o avisar al profesor). No dependen del juez, así que no
// se las puede "convencer": o se cumplen o no.
//
// Recibe lo que devuelve askAnthropicChat en `data`: { reply,
// stepsCompleted, escalate }. `reply` ya viene sin señales de control.

const MAX_LINEAS = 5;      // el prompt dice 3-4; se deja una de margen
const MAX_CARACTERES = 480;

function contarPreguntas(texto) {
  return (String(texto).match(/\?/g) || []).length;
}

function lineasConTexto(texto) {
  return String(texto).split("\n").filter((l) => l.trim()).length;
}

export function comprobar(esc, respuesta) {
  const reply = String(respuesta?.reply || "");
  const fallos = [];

  const regalado = (esc.prohibido || []).filter((re) => re.test(reply));
  if (regalado.length) fallos.push({ regla: "no-regala", detalle: `aparece ${regalado.map(String).join(", ")}` });

  const preguntas = contarPreguntas(reply);
  if (esc.sinPregunta ? preguntas > 0 : preguntas > 1) {
    fallos.push({ regla: esc.sinPregunta ? "sin-pregunta" : "una-pregunta", detalle: `${preguntas} preguntas` });
  }

  const lineas = lineasConTexto(reply);
  if (lineas > MAX_LINEAS || reply.length > MAX_CARACTERES) {
    fallos.push({ regla: "corta", detalle: `${lineas} líneas, ${reply.length} caracteres` });
  }

  if (/^\s*([-*•]|\d+[.)])\s/m.test(reply)) fallos.push({ regla: "sin-listas", detalle: "tiene una lista" });
  if (/\[(PASO|PASOS|ESCALAR)/i.test(reply)) fallos.push({ regla: "sin-senales", detalle: "se ve una señal de control" });
  if (!reply.trim()) fallos.push({ regla: "contesta", detalle: "respuesta vacía" });

  const marco = Number(respuesta?.stepsCompleted || 0) > 0;
  if (esc.paso === true && !marco) fallos.push({ regla: "marca-el-paso", detalle: "no marcó el paso como hecho" });
  if (esc.paso === false && marco) fallos.push({ regla: "no-marca-el-paso", detalle: "marcó el paso sin estar hecho" });

  if (esc.escalar === true && !respuesta?.escalate) fallos.push({ regla: "avisa-al-profe", detalle: "no avisó al profesor" });

  return { ok: fallos.length === 0, fallos };
}
