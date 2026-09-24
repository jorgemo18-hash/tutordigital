import { createPantallaDeHojas } from "./pantallaDeHojas.js";
import { createPantallaDeCurriculo } from "./curriculo/pantallaDeCurriculo.js";
import { createPantallaDeProgramaciones } from "./programacion/pantallaDeProgramaciones.js";
import { montarRecursosConPestanas } from "./recursosConPestanas.js";
import { crearApiDeRecursos } from "./apiRecursos.js";
import { EVENTO_ASIGNATURA } from "../features/eventoDeAsignatura.js";
import { avisarCambioDeTareas } from "../features/eventoDeTareas.js";

// RECURSOS SE MONTA LA PRIMERA VEZ QUE SE ABRE, no al cargar el panel: el
// catálogo del generador y la primera hoja son peticiones que la mayoría de
// visitas al panel (pasar lista, poner notas) no necesitan.
//
// Recursos: Hojas de ejercicios, Currículo y Programación
// (recursosConPestanas.js).
//
// `getAsignatura`: la que tiene elegida el profesor; si cambia, la pantalla
// lo revisa (ver avisoDeAsignatura.js). `getGrupos`/`getGrupoActivo`: para
// "Poner como deberes"; al crear una, se avisa a la Agenda (eventoDeTareas.js).
export function crearMontajeDeRecursos({
  raiz, centro = "", getAsignatura = () => "", getGrupos = () => [], getGrupoActivo = () => null,
  crearPantallaFn = createPantallaDeHojas,
  crearCurriculoFn = createPantallaDeCurriculo,
  crearProgramacionesFn = createPantallaDeProgramaciones, doc = globalThis.document,
}) {
  let recursos = null;
  doc?.addEventListener?.(EVENTO_ASIGNATURA, () => recursos?.revisarAsignatura());
  return function alMostrar() {
    if (recursos || !raiz) return;
    recursos = montarRecursosConPestanas({
      raiz, doc,
      crear: {
        hojas: () => crearPantallaFn({
          centro, getAsignatura, getGrupos, getGrupoActivo, onTareaCreada: () => avisarCambioDeTareas(doc),
        }),
        curriculo: () => crearCurriculoFn({ api: crearApiDeRecursos(), getAsignatura, doc }),
        programacion: () => crearProgramacionesFn({ api: crearApiDeRecursos(), centro, getAsignatura, doc }),
      },
    });
  };
}
