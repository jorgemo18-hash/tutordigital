// DICTAR TEXTO CON EL MICRÓFONO, con el reconocimiento de voz del navegador.
//
// Jorge, el 23/9: *"mira cómo lo hacíamos en el tutor, yo creo que con
// navegador"*. Es la misma API que el micrófono del tutor
// (assets/student/controllers/mic.js) y con las dos lecciones que dejó ese
// archivo: español de España, y un temporizador de seguridad, porque Safari a
// veces deja el reconocimiento colgado sin avisar. Lo del tutor no se reusa
// tal cual porque está atado al estado del chat del alumno.
//
// Funciona en Chrome y Safari; en Firefox no existe y el botón no se enseña
// (`dictadoDisponible`). El audio lo procesa el navegador, no nuestro servidor.
const TIEMPO_MAXIMO_MS = 20000;

function constructor(win) {
  return win?.SpeechRecognition || win?.webkitSpeechRecognition || null;
}

export function dictadoDisponible(win = globalThis.window) {
  return Boolean(constructor(win));
}

// `onTexto(texto, esFinal)`: lo reconocido hasta ahora (va cambiando mientras
// se habla). `onFin()`: se acabó, con o sin texto. `onError(mensaje)`.
export function createDictado({ onTexto, onFin = () => {}, onError = () => {}, win = globalThis.window } = {}) {
  const Ctor = constructor(win);
  let rec = null;
  let activo = false;
  let seguridad = 0;

  function terminar() {
    clearTimeout(seguridad);
    if (!activo) return;
    activo = false;
    onFin();
  }

  return {
    get activo() { return activo; },
    empezar() {
      if (!Ctor || activo) return false;
      rec = new Ctor();
      rec.lang = "es-ES";
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (e) => {
        const texto = [...e.results].map((r) => r[0]?.transcript || "").join("").trim();
        const final = e.results[e.results.length - 1]?.isFinal;
        onTexto(texto, Boolean(final));
      };
      rec.onerror = (e) => {
        const permiso = e?.error === "not-allowed" || e?.error === "service-not-allowed";
        onError(permiso
          ? "El navegador no deja usar el micrófono. Revisa el permiso del micrófono para esta página."
          : "No se ha entendido el dictado. Prueba otra vez.");
        terminar();
      };
      rec.onend = terminar;
      activo = true;
      seguridad = setTimeout(() => { try { rec.stop(); } catch { /* ya parado */ } terminar(); }, TIEMPO_MAXIMO_MS);
      try {
        rec.start();
      } catch {
        onError("No se ha podido empezar a dictar.");
        terminar();
        return false;
      }
      return true;
    },
    parar() {
      try { rec?.stop(); } catch { /* ya parado */ }
    },
  };
}
