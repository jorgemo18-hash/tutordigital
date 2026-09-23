// LA BARRA PARA CAMBIAR UN EJERCICIO SUELTO. Aparece al pulsar un ejercicio
// de la hoja. Jorge (16/9 y 23/9): descartar un ejercicio concreto sin
// deshacer la hoja, y elegir entre "otro parecido" (los mismos, con otros
// números) o "uno en concreto" de la lista del objetivo. Y quitarlo.
//
// Describir o dictar el ejercicio que se quiere es la fase 2 (con IA) y aquí
// todavía no está.
export function buildEditorDeEjercicio({ onOtroParecido, onCambiarPor, onQuitar, onCerrar, doc = document }) {
  const wrap = doc.createElement("div");
  wrap.className = "ej-editor";
  wrap.hidden = true;

  const titulo = doc.createElement("span");
  titulo.className = "ej-editor-tit";

  const otro = doc.createElement("button");
  otro.type = "button";
  otro.className = "ac-btn ghost sm";
  otro.textContent = "Otro parecido";
  otro.addEventListener("click", () => onOtroParecido());

  const cambiar = doc.createElement("select");
  cambiar.className = "ac-select ej-editor-cambiar";
  cambiar.addEventListener("change", () => {
    if (!cambiar.value) return;
    const clave = cambiar.value;
    cambiar.value = "";
    onCambiarPor(clave);
  });

  const quitar = doc.createElement("button");
  quitar.type = "button";
  quitar.className = "ac-btn danger sm";
  quitar.textContent = "Quitar";
  quitar.addEventListener("click", () => onQuitar());

  const cerrar = doc.createElement("button");
  cerrar.type = "button";
  cerrar.className = "ej-editor-cerrar";
  cerrar.setAttribute("aria-label", "Cerrar");
  cerrar.textContent = "×";
  cerrar.addEventListener("click", () => onCerrar());

  wrap.append(titulo, otro, cambiar, quitar, cerrar);
  let puedeCambiar = false;
  let puedeQuitarlo = false;

  return {
    el: wrap,
    // `baterias`: las del objetivo, para "cambiar por". `actual`: la clave del
    // hueco elegido (no se ofrece cambiarlo por sí mismo: eso es "otro
    // parecido"). `puedeQuitar`: falso si es el único ejercicio.
    mostrar({ numero, nombre, baterias, actual, puedeQuitar }) {
      titulo.textContent = `Ejercicio ${numero}${nombre ? ` · ${nombre}` : ""}`;
      cambiar.replaceChildren();
      const cabeza = doc.createElement("option");
      cabeza.value = "";
      cabeza.textContent = "Cambiar por…";
      cambiar.appendChild(cabeza);
      for (const b of baterias.filter((x) => x.clave !== actual)) {
        const op = doc.createElement("option");
        op.value = b.clave;
        op.textContent = b.nombre;
        cambiar.appendChild(op);
      }
      puedeCambiar = cambiar.options.length > 1;
      puedeQuitarlo = Boolean(puedeQuitar);
      cambiar.disabled = !puedeCambiar;
      quitar.disabled = !puedeQuitarlo;
      otro.disabled = false;
      wrap.hidden = false;
    },
    ocultar() { wrap.hidden = true; },
    setOcupado(ocupado) {
      otro.disabled = ocupado;
      cambiar.disabled = ocupado || !puedeCambiar;
      quitar.disabled = ocupado || !puedeQuitarlo;
    },
  };
}
