// mobileTeacherRecursos.js — Recursos → Hojas de ejercicios en el panel móvil.
//
// Recursos: Hojas de ejercicios, Currículo y Programación, como en escritorio. La de
// hojas es LA MISMA PANTALLA que en escritorio (js/recursos/pantallaDeHojas.js),
// en modo móvil: una columna, la barra de contexto plegada, el folio a
// pantalla completa, subir/bajar con botones y los diálogos como hojas
// inferiores (ver styles/teacher-new/11-recursos-movil.css). Una sola
// lógica: lo que se arregle en una se arregla en las dos.
//
// Se monta la primera vez que se abre la pestaña, como en escritorio.
import { createPantallaDeHojas } from "../js/recursos/pantallaDeHojas.js";
import { createPantallaDeCurriculo } from "../js/recursos/curriculo/pantallaDeCurriculo.js";
import { createPantallaDeProgramaciones } from "../js/recursos/programacion/pantallaDeProgramaciones.js";
import { montarRecursosConPestanas } from "../js/recursos/recursosConPestanas.js";
import { crearApiDeRecursos } from "../js/recursos/apiRecursos.js";

export function initMtRecursos({
  pageEl, headerEl, mtState, centro = "", crearPantallaFn = createPantallaDeHojas,
  crearCurriculoFn = createPantallaDeCurriculo, crearProgramacionesFn = createPantallaDeProgramaciones,
}) {
  headerEl.innerHTML = `
    <div class="mt-header-eyebrow">Recursos</div>
    <div class="mt-header-title">Hojas, currículo y <em>programación</em></div>`;
  const raiz = document.createElement("section");
  raiz.className = "rc rc--movil";
  raiz.id = "mtRecursosContent";
  pageEl.appendChild(raiz);

  const getAsignatura = () => mtState.currentSubjectName || "";
  let recursos = null;
  return {
    alMostrar() {
      if (recursos) {
        recursos.revisarAsignatura();
        return;
      }
      recursos = montarRecursosConPestanas({
        raiz,
        crear: {
          hojas: () => crearPantallaFn({ centro, movil: true, getAsignatura }),
          curriculo: () => crearCurriculoFn({ api: crearApiDeRecursos(), getAsignatura }),
          programacion: () => crearProgramacionesFn({ api: crearApiDeRecursos(), centro, getAsignatura }),
        },
      });
    },
  };
}
