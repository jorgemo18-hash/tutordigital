import { z } from "zod";

// LOS PASOS DE CADA TIPO DE EJERCICIO (el «método»), para el tutor.
//
// Decidido con Jorge el 1–2/10/2026 (claude/tutor-arquitectura.md):
//   - El alumno ve HITOS: pocos (1 a 4) y amplios, para que vea que avanza
//     sin liarse con «¿ya he pasado de paso?».
//   - Por debajo, cada línea que escribe se comprueba con código, esté en el
//     hito que esté. Un hito se da por hecho cuando el alumno llega a la
//     FORMA que dice `termina` (y llegar a la forma de un hito posterior da
//     por hechos los anteriores: quien despeja de golpe no repite nada).
//   - Los hitos dicen QUÉ conseguir, nunca CÓMO: valen igual para quien
//     transpone («pasa restando») y para quien resta en los dos lados (la
//     balanza). Ver claude/algebra-1eso-metodo.md.
//   - `errores`: los del catálogo del tema (su número, el `orden` de la
//     migración) que se esperan en ESE hito. Los que pueden salir en
//     cualquier paso (cuenta mal, descuido) van una vez, en
//     `erroresDeCualquierPaso`.
//   - `alumno`: el título del hito, NEUTRO («El paréntesis», «Despejar la
//     x»), nunca la orden («Quita el paréntesis»): el título no puede
//     decirle qué hacer.
//   - `pista`: la pista general del hito (nivel 2 de la ayuda), una sola
//     pregunta que dirige la atención sin dar la operación.
//
// UNA CLAVE POR BATERÍA: la misma `clave` que emite el generador del tema
// (generadorEjercicios/temas/), que es la que lleva cada ejercicio de la hoja.

// QUÉ SIGNIFICA CADA `termina`. Es el contrato con el comprobador (fase 3):
// cada forma tiene que poder decidirla el código, salvo la última.
export const FORMAS = {
  valor: "El resultado final, correcto.",
  sustitucion: "La expresión con las letras cambiadas por sus números, sin letras, y que da el valor correcto (aunque aún no esté calculada).",
  expresion_equivalente: "Una expresión equivalente a la de la solución (da lo mismo para cualquier valor de la letra).",
  expresion_reducida: "Equivalente a la solución y ya reducida: sin paréntesis, un solo término con x y un solo número.",
  sin_parentesis: "Equivalente a la anterior y ya sin paréntesis.",
  x_en_un_lado: "Una ecuación equivalente con los términos con x en un miembro y los números en el otro.",
  ax_igual_b: "Una ecuación equivalente de la forma «número · x = número», ya reducida.",
  x_despejada: "x = el valor correcto.",
  ecuacion_planteada: "Una ecuación que tiene la misma solución que la del problema y sale de su enunciado.",
  diferencia: "Cuánto cambia la secuencia de un término al siguiente (con su signo).",
  decision: "La respuesta sí/no correcta.",
  lo_juzga_el_tutor: "No se puede comprobar con código (escoger la incógnita, responder con palabras): lo valora la IA.",
};

const Hito = z.object({
  id: z.string().regex(/^[a-z_]+$/),
  alumno: z.string().min(5).max(70),
  termina: z.enum(Object.keys(FORMAS)),
  errores: z.array(z.number().int().min(1)).default([]),
  pista: z.string().min(10).max(160).refine((t) => (t.match(/\?/g) || []).length === 1, "una sola pregunta"),
}).strict();

export const MetodoSchema = z.object({
  hitos: z.array(Hito).min(1).max(4),
}).strict();

export const MetodosDelTemaSchema = z.object({
  tema: z.string().regex(/^c0000000-0000-4000-8000-\d{12}$/),
  erroresDeCualquierPaso: z.array(z.number().int().min(1)),
  porClave: z.record(z.string(), MetodoSchema),
}).strict();
