import {
  normalizarPrecios,
  precioDe,
  conPrecio,
  anadirFila,
  anadirColumna,
  quitarFila,
  quitarColumna,
  renombrarFila,
  renombrarColumna,
  LIMITES_PRECIOS,
} from "../../../../../../shared/js/preciosPublicos.js";

// La tabla de precios editable: los encabezados de fila y de columna los
// escribe el admin, y hay un "+" en cada eje.
//
// POR QUÉ NO SE REPINTA AL ESCRIBIR. Los títulos y los precios se escriben
// en `<input>` y cada tecla actualiza el modelo, pero NO vuelve a dibujar la
// tabla: repintar en cada letra le quitaría el foco al input y solo se
// podría teclear un carácter por clic. Solo se repinta cuando cambia la
// FORMA de la tabla (añadir o quitar una fila o una columna), que es cuando
// el foco ya se ha ido de todas formas.
//
// `onCambio()` avisa a quien monta el panel de que hay algo sin guardar; el
// valor se pide con `getValue()` al pulsar Guardar, no se manda solo.

function buildInputTitulo(valor, placeholder, onEscribir) {
  const input = document.createElement("input");
  input.className = "ac-precio-titulo";
  input.type = "text";
  input.value = valor || "";
  input.placeholder = placeholder;
  input.maxLength = LIMITES_PRECIOS.MAX_TEXTO;
  input.addEventListener("input", () => onEscribir(input.value));
  return input;
}

// La "×" de borrar fila/columna. Va dentro del encabezado y sin confirmar:
// lo que se pierde es una palabra y los precios de esa línea, y el admin no
// ha guardado todavía — un diálogo por cada retoque de una tabla que se
// monta a base de probar sería más molesto que el error que evita.
function buildBotonQuitar(titulo, onQuitar) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-precio-quitar";
  btn.title = titulo;
  btn.setAttribute("aria-label", titulo);
  btn.textContent = "×";
  btn.addEventListener("click", onQuitar);
  return btn;
}

function buildBotonAnadir(texto, titulo, clase, onAnadir) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ac-precio-add ${clase}`;
  btn.title = titulo;
  btn.setAttribute("aria-label", titulo);
  btn.textContent = texto;
  btn.addEventListener("click", onAnadir);
  return btn;
}

export function buildTablaPrecios(modeloInicial, { onCambio = () => {} } = {}) {
  let modelo = normalizarPrecios(modeloInicial);

  const el = document.createElement("div");
  el.className = "ac-precios-wrap";

  function cambiar(nuevo, { repintar = false } = {}) {
    modelo = nuevo;
    onCambio();
    if (repintar) render();
  }

  function buildCabecera() {
    const tr = document.createElement("tr");
    // La esquina va vacía: es el cruce entre "qué se da" y "cuánto se
    // viene", y ponerle un título obligaría a inventar uno que no encaja en
    // todas las academias.
    tr.appendChild(document.createElement("th"));

    for (const columna of modelo.columnas) {
      const th = document.createElement("th");
      th.className = "ac-precio-th";
      th.append(
        buildInputTitulo(columna.titulo, "Etapa o materia", (valor) =>
          cambiar(renombrarColumna(modelo, columna.id, valor))
        ),
        buildBotonQuitar(`Quitar la columna ${columna.titulo || "sin título"}`, () =>
          cambiar(quitarColumna(modelo, columna.id), { repintar: true })
        )
      );
      tr.appendChild(th);
    }

    const addCol = document.createElement("th");
    addCol.className = "ac-precio-th-add";
    if (modelo.columnas.length < LIMITES_PRECIOS.MAX_EJE) {
      addCol.appendChild(
        buildBotonAnadir("+", "Añadir columna", "col", () => cambiar(anadirColumna(modelo), { repintar: true }))
      );
    }
    tr.appendChild(addCol);
    return tr;
  }

  function buildFila(fila) {
    const tr = document.createElement("tr");

    const th = document.createElement("th");
    th.className = "ac-precio-th fila";
    th.append(
      buildInputTitulo(fila.titulo, "Concepto", (valor) => cambiar(renombrarFila(modelo, fila.id, valor))),
      buildBotonQuitar(`Quitar la fila ${fila.titulo || "sin título"}`, () =>
        cambiar(quitarFila(modelo, fila.id), { repintar: true })
      )
    );
    tr.appendChild(th);

    for (const columna of modelo.columnas) {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.className = "ac-precio-celda";
      input.type = "text";
      input.value = precioDe(modelo, fila.id, columna.id);
      // Sin placeholder de ejemplo ("55 €") a propósito: en una tabla de
      // doce casillas, doce fantasmas de "55 €" se leen como precios ya
      // puestos y se guarda media tabla en blanco creyendo que está llena.
      input.placeholder = "";
      input.inputMode = "decimal";
      input.maxLength = 24;
      input.addEventListener("input", () => cambiar(conPrecio(modelo, fila.id, columna.id, input.value)));
      td.appendChild(input);
      tr.appendChild(td);
    }

    tr.appendChild(document.createElement("td"));
    return tr;
  }

  function buildFilaAnadir() {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.className = "ac-precio-td-add";
    td.colSpan = modelo.columnas.length + 2;
    td.appendChild(
      buildBotonAnadir("+ Añadir fila", "Añadir fila", "fila", () => cambiar(anadirFila(modelo), { repintar: true }))
    );
    tr.appendChild(td);
    return tr;
  }

  function render() {
    el.innerHTML = "";
    const tabla = document.createElement("table");
    tabla.className = "ac-precios";

    const thead = document.createElement("thead");
    thead.appendChild(buildCabecera());

    const tbody = document.createElement("tbody");
    for (const fila of modelo.filas) tbody.appendChild(buildFila(fila));
    if (modelo.filas.length < LIMITES_PRECIOS.MAX_EJE) tbody.appendChild(buildFilaAnadir());

    tabla.append(thead, tbody);
    el.appendChild(tabla);
  }

  render();

  return {
    el,
    getValue: () => normalizarPrecios(modelo),
    setValue: (nuevo) => {
      modelo = normalizarPrecios(nuevo);
      render();
    },
  };
}
