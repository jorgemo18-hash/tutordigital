import { valoresAceptados } from "./comparaFicha.js";

// "ESTO DICE LA FICHA. ¿QUÉ SUSTITUYO?"
//
// Jorge eligió esto sobre las otras dos salidas, y conviene dejar escrito
// por qué, porque las dos eran más fáciles de programar:
//
//   - "sustituir todo o nada": si el OCR se equivoca en UN campo, o te lo
//     tragas entero o no aprovechas ninguno.
//   - "sustituir siempre": resuelve su caso de hoy y el día que suba una
//     ficha antigua le machaca datos buenos sin decir nada.
//
// Se enseña SOLO LO QUE CAMBIA. Una lista con los veinte campos, la mayoría
// iguales, obliga a buscar los tres que importan, y lo que se lee entero es
// una lista corta.
//
// Usa el modal que ya existe en el panel (.ac-modal-*, ver elegirAccionDialog
// .js) en vez de inventar otro: dos modales distintos en la misma aplicación
// se leen como dos programas distintos.
//
// Devuelve `{ alumno, familia }` con lo aceptado, o `null` si se cancela —
// nunca lanza. Cancelar NO deshace la subida de la foto: el documento ya
// está guardado y eso es lo que no se podía perder.

function buildFila(diferencia) {
  const fila = document.createElement("label");
  fila.className = "ac-ficha-dif";

  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = diferencia.aceptado;
  check.className = "ac-ficha-dif-check";
  check.addEventListener("change", () => { diferencia.aceptado = check.checked; });

  const cuerpo = document.createElement("span");
  cuerpo.className = "ac-ficha-dif-cuerpo";

  const etiqueta = document.createElement("span");
  etiqueta.className = "ac-ficha-dif-campo";
  etiqueta.textContent = diferencia.etiqueta;

  const valores = document.createElement("span");
  valores.className = "ac-ficha-dif-valores";
  if (diferencia.estado === "hueco") {
    // "Estaba vacío" y no "— → valor": una flecha desde la nada se lee como
    // si se fuera a borrar algo.
    valores.textContent = `estaba vacío · la ficha dice ${diferencia.leido}`;
  } else {
    const antes = document.createElement("s");
    antes.textContent = diferencia.actual;
    valores.append("tienes ", antes, ` · la ficha dice ${diferencia.leido}`);
  }

  cuerpo.append(etiqueta, valores);
  fila.append(check, cuerpo);
  // `marcar` y no un evento sintético: "usar todo" tenía que poner las
  // casillas Y la lista de diferencias de acuerdo, y hacerlo disparando un
  // `change` a mano deja el estado dependiendo de que el evento llegue.
  // Una función pone las dos cosas en la misma línea y se puede probar.
  return { fila, marcar: (valor) => { check.checked = valor; diferencia.aceptado = valor; } };
}

function buildGrupo(titulo, diferencias) {
  if (!diferencias.length) return { wrap: null, marcadores: [] };
  const wrap = document.createElement("div");
  wrap.className = "ac-ficha-dif-grupo";
  const tit = document.createElement("div");
  tit.className = "ac-section-title";
  tit.textContent = titulo;
  wrap.appendChild(tit);
  const marcadores = [];
  for (const diferencia of diferencias) {
    const { fila, marcar } = buildFila(diferencia);
    wrap.appendChild(fila);
    marcadores.push(marcar);
  }
  return { wrap, marcadores };
}

export function dialogoComparaFicha({ alumno = [], familia = [] }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "ac-modal-overlay";

    const panel = document.createElement("div");
    panel.className = "ac-modal-panel ac-modal-panel--ancho";

    // LA LISTA SE DESPLAZA, EL TÍTULO Y LOS BOTONES NO. Con el panel entero
    // desplazable —que es como estaba— una ficha con doce diferencias dejaba
    // los botones al final de la lista: había que bajar hasta abajo para
    // encontrar "Usar todo lo de la ficha", que es justo el que más se va a
    // usar. Y al enfocar un botón, el navegador arrastraba el desplazamiento
    // y el diálogo se abría SIN el título ni las primeras filas a la vista.
    const cuerpo = document.createElement("div");
    cuerpo.className = "ac-ficha-dif-cuerpo-scroll";

    const titulo = document.createElement("p");
    titulo.className = "ac-modal-titulo";
    titulo.textContent = "La ficha no dice lo mismo que la ficha guardada";
    panel.appendChild(titulo);

    const nota = document.createElement("p");
    nota.className = "ac-field-hint";
    // Dice DÓNDE queda el cambio, porque no se guarda aquí: se rellenan los
    // campos del drawer y el admin sigue teniendo que pulsar Guardar. Sin
    // esta frase, aceptar parece que ya ha escrito en la base de datos.
    nota.textContent = "Lo que marques se escribirá en los campos del alumno. "
      + "Se guarda cuando pulses Guardar, no ahora.";
    panel.appendChild(nota);

    const grupoAlumno = buildGrupo("ALUMNO", alumno);
    const grupoFamilia = buildGrupo("FAMILIA", familia);
    if (grupoAlumno.wrap) cuerpo.appendChild(grupoAlumno.wrap);
    if (grupoFamilia.wrap) cuerpo.appendChild(grupoFamilia.wrap);
    panel.appendChild(cuerpo);
    const marcarTodo = [...grupoAlumno.marcadores, ...grupoFamilia.marcadores];

    const acciones = document.createElement("div");
    acciones.className = "ac-modal-acciones";

    function cerrar(valor) {
      document.removeEventListener("keydown", onKeydown);
      overlay.remove();
      resolve(valor);
    }
    function onKeydown(e) {
      if (e.key === "Escape") cerrar(null);
    }

    // EL BOTÓN DEL CASO DE JORGE. Su alumno se creó con datos inventados
    // para que saliera en el horario, así que la ficha gana en todo — y
    // marcar ocho casillas a mano para eso sería absurdo. Es un gesto
    // consciente y uno solo, que es lo que lo distingue de "sustituir
    // siempre sin preguntar".
    const todo = document.createElement("button");
    todo.type = "button";
    todo.className = "ac-btn primary";
    todo.textContent = "Usar todo lo de la ficha";
    todo.addEventListener("click", () => {
      marcarTodo.forEach((marcar) => marcar(true));
      cerrar({ alumno: valoresAceptados(alumno), familia: valoresAceptados(familia) });
    });

    const marcadas = document.createElement("button");
    marcadas.type = "button";
    marcadas.className = "ac-btn copper";
    marcadas.textContent = "Usar solo lo marcado";
    marcadas.addEventListener("click", () => {
      cerrar({ alumno: valoresAceptados(alumno), familia: valoresAceptados(familia) });
    });

    const cancelar = document.createElement("button");
    cancelar.type = "button";
    cancelar.className = "ac-btn ghost";
    // "No cambiar nada" y no "Cancelar": la foto ya se ha subido y cancelar
    // podría leerse como que también se deshace eso.
    cancelar.textContent = "No cambiar nada";
    cancelar.addEventListener("click", () => cerrar(null));

    acciones.append(todo, marcadas, cancelar);
    panel.appendChild(acciones);
    overlay.appendChild(panel);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrar(null); });
    document.addEventListener("keydown", onKeydown);
    document.body.appendChild(overlay);
    // `preventScroll` es lo que impide que enfocar el botón arrastre la
    // lista y el diálogo se abra por la mitad. Se vio mirando la captura.
    marcadas.focus({ preventScroll: true });
  });
}
