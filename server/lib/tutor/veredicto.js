// EL VEREDICTO DE UN MENSAJE DEL ALUMNO, ANTES DE LLAMAR A LA IA (2/10/2026).
//
// Junta las piezas: qué líneas de cuentas trae el mensaje, de qué apartado
// son, si están bien (comprobador), hasta qué paso ha llegado, qué error
// probable hay y en qué peldaño de la escalera está. Todo con código. La IA
// recibe el resultado como un hecho y solo lo explica.
//
// Puro: lo que viene de la base de datos (fallos previos, el error del
// catálogo, el ejemplo) llega como funciones, para poder probarlo sin base.
import { lineasDeCuentas, apartadoDelMensaje, expandirCadena } from "./comprobador/lineasDelMensaje.js";
import { comprobarLineas } from "./comprobador/lineas.js";
import { hitosDelEnvio } from "./comprobador/hitos.js";
import { peldano } from "./escalera.js";

const numeroSuelto = (texto) => (String(texto).match(/[−-]?\d+(?:[.,]\d+)?/g) || []).slice(-1);

export function comprobarMensaje({ texto, actividad, fallosPrevios = () => 0, describirError = () => null, ejemplo = () => null, abierto = null }) {
  if (!actividad?.metodo || !actividad.apartados.some((a) => a.referencia)) return { estado: "no_comprobable" };

  const escritas = lineasDeCuentas(texto);
  // Para reconocer el apartado, las cadenas de iguales se abren como en una
  // ecuación (lo que lee una expresión también lo entiende así).
  const cual = apartadoDelMensaje({ texto, lineas: escritas.flatMap((l) => expandirCadena(l, "ecuacion")), apartados: actividad.apartados, abierto });
  if (cual.indice == null) return cual.como === "sin_lineas" ? { estado: "sin_cuentas" } : { estado: "apartado_desconocido", candidatos: cual.candidatos || [] };

  const apartado = actividad.apartados[cual.indice];
  if (!apartado.referencia) return { estado: "no_comprobable" };
  let lineas = escritas.flatMap((l) => expandirCadena(l, apartado.referencia.tipo));
  // En una expresión, el resultado suelto («es −12») también es una línea.
  if (!lineas.length && apartado.referencia.tipo === "expresion") lineas = numeroSuelto(texto);
  if (!lineas.length) return { estado: "sin_cuentas", apartado: cual.indice };

  const comprobacion = comprobarLineas({ referencia: apartado.referencia, lineas });
  const { hitos, dudosas, errorProbable } = hitosDelEnvio({ metodo: actividad.metodo, comprobacion, tipo: apartado.referencia.tipo, trampas: apartado.trampas });
  const hitoMal = hitos.find((h) => h.estado === "mal")?.id || null;
  const nivel = hitoMal ? peldano(fallosPrevios(cual.indice, hitoMal)) : 0;
  const todoHecho = !dudosas.length && comprobacion.primeraMal == null && hitos.every((h) => h.estado === "hecho");

  return {
    estado: "comprobado",
    apartado: cual.indice,
    enunciado: apartado.referencia.enunciado,
    metodo: actividad.metodo,
    comprobacion,
    hitos,
    dudosas,
    hitoMal,
    errorProbable,
    error: errorProbable?.error ? describirError(errorProbable.error) : null,
    nivel,
    todoHecho,
    ejemplo: nivel === 3 ? ejemplo(apartado.texto) : null,
  };
}
