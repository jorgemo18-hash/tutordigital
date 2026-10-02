// QUÉ ECUACIÓN O EXPRESIÓN TIENE DELANTE EL ALUMNO, sacada del apartado de
// nuestra hoja (el texto plano que guarda la hoja: respuestasDe en
// generadorEjercicios/errores/trampasDelApartado.js).
//
// Solo para las baterías que el comprobador sabe leer. Las demás (traducir
// una frase, secuencias, ¿es solución?, problemas) devuelven null: el tutor
// las guía sin veredicto del código, como hasta ahora.
import { normaliza } from "./notacionDelAlumno.js";

const ECUACIONES = new Set(["ecuacion_suma_resta", "ecuacion_producto_cociente", "ecuacion_dos_pasos", "ecuacion_x_dos_lados", "ecuacion_con_parentesis"]);
const EXPRESIONES = new Set(["reduce_semejantes", "reduce_con_parentesis"]);

export function referenciaDelApartado(clave, texto) {
  const t = String(texto || "");
  try {
    if (ECUACIONES.has(clave)) {
      const enunciado = t.split("→")[0];
      return { tipo: "ecuacion", ecuacion: normaliza(enunciado), enunciado: enunciado.trim() };
    }
    if (EXPRESIONES.has(clave)) {
      const enunciado = t.replace(/=\s*_+\s*$/, "");
      return { tipo: "expresion", expresion: normaliza(enunciado), enunciado: enunciado.trim() };
    }
    if (clave === "valor_numerico") {
      // «5x − 8 para x = 9: ___» → la expresión con la x ya sustituida: 5*(9)-8.
      const m = t.match(/^(.*?)\s+para\s+x\s*=\s*([^:]+):/);
      if (!m) return null;
      const valor = normaliza(m[2]);
      return { tipo: "expresion", expresion: normaliza(m[1]).replace(/x/g, `(${valor})`), enunciado: m[0].replace(/:$/, "").trim() };
    }
  } catch {
    return null;
  }
  return null;
}
