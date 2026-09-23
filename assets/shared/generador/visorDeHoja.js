// LA HOJA DENTRO DEL PANEL: un iframe con la página imprimible.
//
// Por qué un iframe y no pintarla directamente en el panel: ver el
// comentario de assets/shared/hoja/hoja-imprimible.html. En corto, para que
// "Imprimir" imprima SOLO la hoja y para que el tema oscuro del panel no la
// toque.
//
// La página del iframe avisa cuando ya puede pintar (`hojaLista`); hasta
// entonces lo pedido se guarda y se pinta al llegar el aviso.
export const RUTA_HOJA = "/assets/shared/hoja/hoja-imprimible.html";

// `onActividad(orden)`: se ha pulsado el ejercicio `orden` de la hoja (para
// cambiarlo o quitarlo). `clase`: la del panel que lo usa (la academia y
// Recursos del profesor lo visten cada uno con su CSS).
export function createVisorDeHoja({ doc = document, onActividad = () => {}, clase = "ej-visor" } = {}) {
  const iframe = doc.createElement("iframe");
  iframe.className = clase;
  iframe.title = "Hoja de ejercicios";
  iframe.src = RUTA_HOJA;

  let pendiente = null;
  let elegida = null;

  function marcar() {
    const d = win()?.document;
    if (!d) return;
    d.querySelectorAll(".hj-act").forEach((a) => {
      a.classList.toggle("ej-elegida", Number(a.dataset.orden) === elegida);
    });
  }

  function win() {
    return iframe.contentWindow;
  }

  function lista() {
    return Boolean(win()?.hojaLista && typeof win().pintarHojaImprimible === "function");
  }

  // El alto del iframe se ajusta a la hoja (una o dos páginas A4), para que
  // se desplace el panel y no haya una barra de scroll dentro de otra. Se
  // vuelve a medir un momento después: las fórmulas y las letras llegan
  // tarde y cambian el alto.
  function ajustarAlto() {
    const alto = win()?.document?.documentElement?.scrollHeight;
    if (alto) iframe.style.height = `${alto}px`;
  }

  // La página contesta cuando ya ha partido la hoja en folios: solo
  // entonces se sabe el alto de verdad.
  function pintarAhora(contenido) {
    const listo = win().pintarHojaImprimible(contenido);
    marcar();
    ajustarAlto();
    Promise.resolve(listo).then(() => { marcar(); ajustarAlto(); });
  }

  iframe.addEventListener("load", () => {
    // Un solo escuchador en el documento de la hoja, que sobrevive a cada
    // repintado: el número del ejercicio viaja en `data-orden`.
    win()?.document?.addEventListener("click", (e) => {
      const act = e.target?.closest?.(".hj-act");
      if (act) onActividad(Number(act.dataset.orden));
    });
    const alListo = () => {
      if (pendiente) {
        pintarAhora(pendiente);
        pendiente = null;
      }
    };
    if (lista()) alListo();
    else win()?.addEventListener("hoja-lista", alListo, { once: true });
  });

  return {
    el: iframe,
    pintar(contenido) {
      if (lista()) pintarAhora(contenido);
      else pendiente = contenido;
    },
    // Resalta en pantalla el ejercicio que se está cambiando (nunca en
    // papel: el estilo está bajo @media screen en hoja-imprimible.html).
    elegir(orden) {
      elegida = orden;
      marcar();
    },
    imprimir() {
      if (!lista()) return false;
      win().focus();
      win().print();
      return true;
    },
  };
}
