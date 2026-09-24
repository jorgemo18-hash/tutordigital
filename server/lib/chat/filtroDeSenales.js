// LAS SEÑALES DE CONTROL NO LLEGAN A LA PANTALLA DEL ALUMNO.
//
// En las 32 conversaciones reales de mayo-junio, "[PASO_COMPLETADO]" salió
// DOS veces dentro del texto que leía el alumno. El motivo: en modo
// streaming cada trozo del modelo se mandaba al navegador según llegaba, y
// las señales solo se quitaban de la respuesta FINAL (la que se guarda). El
// alumno ya las había visto.
//
// Este filtro se pone entre el modelo y el navegador: en cuanto aparece un
// "[" retiene el texto hasta saber si es una señal (se tira) o no (se manda
// tal cual: "[1, 3]" es un intervalo, no una señal). Lo que no puede ser el
// principio de una señal sale sin esperar, para no frenar el streaming.
//
// Las señales, con las variantes que escribe el modelo (minúsculas,
// espacios en vez de guion bajo):
//   [PASO_COMPLETADO]  [PASOS_COMPLETADOS:N]  [ESCALAR_PROFESOR: motivo]
export const SENAL_RE = /\[\s*(PASOS?[\s_]COMPLETADOS?(\s*:\s*\d+)?|ESCALAR[\s_]PROFESOR(\s*:[^\]]*)?)\s*\]/gi;
const NOMBRES = ["PASO_COMPLETADO", "PASOS_COMPLETADOS", "ESCALAR_PROFESOR"];
const MAX_RETENIDO = 400; // un motivo de escalado largo; más que esto no es una señal

// ¿Puede lo retenido (empieza por "[") acabar siendo una señal?
function puedeSerSenal(retenido) {
  const dentro = retenido.slice(1).replace(/^\s+/, "").toUpperCase().replace(/\s/g, "_");
  return NOMBRES.some((n) => n.startsWith(dentro) || dentro.startsWith(n));
}

export function quitarSenales(texto) {
  return String(texto || "").replace(SENAL_RE, "").replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

export function crearFiltroDeSenales(enviar) {
  let retenido = "";

  function soltar(texto) { if (texto) enviar(texto); }

  function procesar(texto) {
    let resto = texto;
    while (resto) {
      if (!retenido) {
        const i = resto.indexOf("[");
        if (i === -1) { soltar(resto); return; }
        soltar(resto.slice(0, i));
        retenido = "[";
        resto = resto.slice(i + 1);
        continue;
      }
      const cierre = resto.indexOf("]");
      retenido += cierre === -1 ? resto : resto.slice(0, cierre + 1);
      resto = cierre === -1 ? "" : resto.slice(cierre + 1);
      if (cierre !== -1) {
        // Cerrado: si era señal se tira; si no, sale entero.
        if (!new RegExp(SENAL_RE.source, "i").test(retenido)) soltar(retenido);
        retenido = "";
      } else if (!puedeSerSenal(retenido) || retenido.length > MAX_RETENIDO) {
        // No puede ser una señal: sale, y lo que venga detrás se vuelve a mirar.
        const salida = retenido;
        retenido = "";
        const otro = salida.indexOf("[", 1);
        if (otro === -1) soltar(salida);
        else { soltar(salida.slice(0, otro)); resto = salida.slice(otro) + resto; }
      }
    }
  }

  return {
    push(token) { procesar(String(token ?? "")); },
    // Al terminar: lo retenido sin cerrar no era una señal completa.
    flush() { if (retenido && !puedeSerSenal(retenido)) soltar(retenido); retenido = ""; },
  };
}
