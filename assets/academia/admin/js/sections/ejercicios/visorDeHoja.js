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

export function createVisorDeHoja({ doc = document } = {}) {
  const iframe = doc.createElement("iframe");
  iframe.className = "ej-visor";
  iframe.title = "Hoja de ejercicios";
  iframe.src = RUTA_HOJA;

  let pendiente = null;

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

  function pintarAhora(contenido) {
    win().pintarHojaImprimible(contenido);
    ajustarAlto();
    setTimeout(ajustarAlto, 400);
  }

  iframe.addEventListener("load", () => {
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
    imprimir() {
      if (!lista()) return false;
      win().focus();
      win().print();
      return true;
    },
  };
}
