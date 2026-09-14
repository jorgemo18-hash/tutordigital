// EL TEMA SE CAMBIA QUITANDO UNA CLASE Y PONIENDO LA OTRA, NO REESCRIBIENDO
// LA LISTA ENTERA.
//
// EL FALLO (pequeño y antiguo, arreglado el 14/09/2026). Los dos paneles de
// academia montan su contenedor con tres clases —`ac-app bg-frame ac-oscuro`—
// y al pulsar el botón de tema hacían esto:
//
//   app.className = `ac-app ${temaClase(next)}`;
//
// que es la lista COMPLETA escrita otra vez a mano en un sitio distinto del
// que la montó. Y en esa segunda copia faltaba `bg-frame`, que es el color de
// fondo del panel (`shared/styles/components/bg-layers.css`): al cambiar de
// tema, el panel se quedaba sin fondo hasta recargar la página.
//
// No es un descuido de quien lo escribió: reconstruir un `className` a mano
// OBLIGA a acordarse de todas las demás clases que lleve el elemento, y nada
// avisa cuando te dejas una. Aquí se cambia solo lo que cambia.
//
// Y ESTABA EN LOS DOS PANELES. El documento del proyecto solo tenía apuntado
// el de admin; el de profesor tenía exactamente el mismo fallo y nadie lo
// había visto, porque los dos habían copiado la misma línea.

export const CLASE_TEMA_CLARO = "ac-claro";
export const CLASE_TEMA_OSCURO = "ac-oscuro";

export function temaClase(theme) {
  return theme === "light" ? CLASE_TEMA_CLARO : CLASE_TEMA_OSCURO;
}

// Deja en `el` la clase del tema pedido y quita la del otro, sin tocar ninguna
// otra clase que el elemento lleve.
export function aplicarTema(el, theme) {
  if (!el?.classList) return;
  el.classList.remove(CLASE_TEMA_CLARO, CLASE_TEMA_OSCURO);
  el.classList.add(temaClase(theme));
}
