import { el, boton } from "../elementos.js";

// LA IA EN EL EDITOR DE PROGRAMACIONES: el botón y las marcas de borrador.
//
// La IA hace un PRIMER BORRADOR (unidades, y los apartados de texto que
// estén vacíos). Lo que escribe queda marcado como "Borrador de la IA" hasta
// que el profesor lo toca: una programación entregada tal cual la escribió
// una máquina es un riesgo del profesor, y tiene que verlo.
//
// `ia` (lo crea el editor): { proponerUnidades(), redactar(letras) }, que
// llaman al servidor. Aquí no se habla con la API.

// Un botón que se pone "trabajando" mientras la IA contesta (tarda de 10 a
// 60 segundos) y enseña el error si falla.
export function botonDeIA(doc, { texto, trabajando, alPulsar, onError = () => {} }) {
  const b = boton(doc, texto, { clase: "rc-btn--sm rc-btn--ia" });
  b.addEventListener("click", async () => {
    if (b.disabled) return;
    b.disabled = true;
    b.classList.add("is-cargando");
    b.textContent = trabajando;
    try {
      await alPulsar();
    } catch (err) {
      onError(err?.message || "La IA no ha respondido. Prueba otra vez.");
    } finally {
      if (b.isConnected) {
        b.disabled = false;
        b.classList.remove("is-cargando");
        b.textContent = texto;
      }
    }
  });
  return b;
}

export const letrasVacias = (datos, letras) => letras.filter((l) => !String(datos.textos?.[l] || "").trim());

export function esBorradorIA(datos, letra) {
  return Boolean(datos.ia?.textos?.includes(letra));
}

// Mete los textos de la IA SOLO en las letras vacías (lo escrito por el
// profesor no se toca nunca) y los marca como borrador.
export function aplicaTextosIA(datos, textos) {
  datos.textos = datos.textos || {};
  const puestas = [];
  for (const [letra, texto] of Object.entries(textos || {})) {
    if (String(datos.textos[letra] || "").trim() || !texto) continue;
    datos.textos[letra] = texto;
    puestas.push(letra);
  }
  if (puestas.length) {
    datos.ia = { ...(datos.ia || {}), textos: [...new Set([...(datos.ia?.textos || []), ...puestas])] };
  }
  return puestas;
}

// El profesor lo ha tocado: ya es suyo.
export function quitaMarcaIA(datos, letra) {
  if (!datos.ia?.textos?.includes(letra)) return false;
  datos.ia.textos = datos.ia.textos.filter((l) => l !== letra);
  return true;
}

export function etiquetaIA(doc) {
  const t = el(doc, "span", "rc-tag rc-tag--ia", "Borrador de la IA · revísalo");
  t.title = "Lo ha escrito la IA. Deja de marcarse en cuanto lo cambias.";
  return t;
}

// La barra de arriba de un paso: el botón y un aviso para errores.
export function barraDeIA(doc, { texto, trabajando, explicacion, alPulsar }) {
  const barra = el(doc, "div", "rc-pg__ia");
  const aviso = el(doc, "p", "rc-msg rc-msg--error");
  aviso.hidden = true;
  const b = botonDeIA(doc, {
    texto, trabajando, alPulsar: async () => { aviso.hidden = true; await alPulsar(); },
    onError: (m) => { aviso.textContent = m; aviso.hidden = false; },
  });
  barra.append(b, el(doc, "span", "rc-sub", explicacion), aviso);
  return barra;
}
