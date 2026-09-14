// EL DINERO SE ESCRIBE EN ESPAÑOL: 2.388,00 € — punto para los miles, coma
// para los céntimos.
//
// EL PROBLEMA (14/09/2026). Toda la aplicación pintaba importes con
// `toFixed(2)`, que es formato inglés: `2388.00 €`. En un panel que usa una
// academia española, y del que salen recibos y modelos fiscales, eso es
// simplemente incorrecto — y además es engañoso a partir del millar: quien lee
// `2388.00` deprisa puede ver "2,388" (dos euros y pico) donde hay dos mil.
//
// POR QUÉ NO SE USA `Intl.NumberFormat`. Porque falla en silencio. Node se
// puede compilar con `small-icu`, y en ese caso `Intl` **no conoce es-ES**: no
// lanza ningún error, se cae a en-US y devuelve `2,388.00`. El backend corre en
// Render, donde no controlamos con qué ICU viene el Node de la imagen, y no
// tenemos forma de leer sus logs para enterarnos. Un formateador de 15 líneas
// escrito a mano da el mismo resultado en cualquier entorno y se puede probar.
//
// UN ESPACIO NORMAL ANTES DEL €, NO UN ESPACIO DURO. Lo tipográficamente
// correcto sería ` `, pero este texto acaba en `textContent`, en
// `innerHTML`, en el cuerpo de un email y en un PDF, y un carácter que se ve
// igual pero no compara igual es una trampa: rompe tests por motivos
// invisibles y ensucia el valor cuando Jorge copia una cifra a una hoja de
// cálculo. Se elige la simplicidad a propósito.

const SEPARADOR_MILES = ".";
const SEPARADOR_DECIMAL = ",";

// Número con separadores españoles, sin símbolo. `decimales` fijos: en dinero
// nunca se recortan los céntimos, porque "1.200,5 €" se lee mal.
export function numeroEs(valor, decimales = 2) {
  const num = Number(valor);
  const seguro = Number.isFinite(num) ? num : 0;
  const negativo = seguro < 0;

  const [entera, decimal = ""] = Math.abs(seguro).toFixed(decimales).split(".");
  const conMiles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, SEPARADOR_MILES);
  const cuerpo = decimales > 0 ? `${conMiles}${SEPARADOR_DECIMAL}${decimal}` : conMiles;

  // El "-0,00" que sale de un redondeo a la baja no es una cantidad negativa.
  if (negativo && Number(cuerpo.replace(/\D/g, "")) === 0) return cuerpo;
  return negativo ? `-${cuerpo}` : cuerpo;
}

// La forma en que se enseña un importe en toda la aplicación.
export function formatoEuros(valor) {
  return `${numeroEs(valor, 2)} €`;
}

// Los porcentajes de descuento viven al lado de los importes en la misma
// pantalla: con la coma decimal en el dinero y el punto en el porcentaje, la
// pantalla parecía tener dos idiomas.
export function formatoPorcentaje(valor, decimales = 2) {
  return `${numeroEs(valor, decimales)}%`;
}
