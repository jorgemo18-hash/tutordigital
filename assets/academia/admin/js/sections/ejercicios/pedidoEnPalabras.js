import { createDictado, dictadoDisponible } from "../../../../../shared/js/dictado.js";

// "PÍDELO CON TUS PALABRAS": escribir o dictar la hoja o el ejercicio que se
// quiere (fase 2, Jorge 23/9). La IA lo traduce al catálogo y, si le falta
// algo, pregunta; la conversación sigue aquí mismo hasta que hay algo que
// aplicar. Lo que decide y lo que no está en interpretePedido.js (servidor).
//
// Este componente solo conversa. Aplicar el resultado (montar la hoja,
// cambiar el ejercicio) es cosa de la sección, que lo recibe por
// `onHoja(plan, explicacion)` y `onEjercicio(clave, explicacion)`.
//
// Deps inyectables: `interpretarFn` (la llamada) y `getContexto()` (lo que
// hay en pantalla, incluido el ejercicio elegido si lo hay).
export function buildPedidoEnPalabras({
  interpretarFn, getContexto, onHoja, onEjercicio, doc = document, win = globalThis.window,
}) {
  let conversacion = [];
  let ocupado = false;

  const wrap = doc.createElement("div");
  wrap.className = "ej-pedido";

  const fila = doc.createElement("div");
  fila.className = "ej-pedido-fila";
  const input = doc.createElement("input");
  input.type = "text";
  input.className = "ac-input ej-pedido-input";
  input.maxLength = 600;
  const mic = doc.createElement("button");
  mic.type = "button";
  mic.className = "ac-btn ghost ej-pedido-mic";
  mic.textContent = "Dictar";
  mic.hidden = !dictadoDisponible(win);
  const enviar = doc.createElement("button");
  enviar.type = "button";
  enviar.className = "ac-btn copper";
  enviar.textContent = "Pedir";
  fila.append(input, mic, enviar);

  // La respuesta de la IA: una pregunta con sus opciones, o el aviso de que
  // lo pedido no está en el catálogo.
  const respuesta = doc.createElement("div");
  respuesta.className = "ej-pedido-respuesta";
  respuesta.hidden = true;

  wrap.append(fila, respuesta);

  function placeholder() {
    const ej = getContexto().ejercicio;
    input.placeholder = ej
      ? `Describe el ejercicio que quieres en lugar del ${ej.orden}…`
      : "Pídelo con tus palabras: «dos de comparar y uno de ordenar, nivel refuerzo»";
  }

  function setOcupado(valor) {
    ocupado = valor;
    [input, enviar, mic].forEach((b) => { b.disabled = valor; });
    enviar.textContent = valor ? "Pensando…" : "Pedir";
  }

  function boton(texto, clase, onClick) {
    const b = doc.createElement("button");
    b.type = "button";
    b.className = `ac-btn ${clase} sm`;
    b.textContent = texto;
    b.addEventListener("click", onClick);
    return b;
  }

  function mostrar(texto, botones = [], { error = false } = {}) {
    const p = doc.createElement("p");
    p.className = error ? "ej-pedido-texto ac-field-hint--error" : "ej-pedido-texto";
    p.textContent = texto;
    const acciones = doc.createElement("div");
    acciones.className = "ej-pedido-acciones";
    acciones.append(...botones);
    respuesta.replaceChildren(p, acciones);
    respuesta.hidden = false;
  }

  function cerrarConversacion() {
    conversacion = [];
    respuesta.hidden = true;
    respuesta.replaceChildren();
  }

  async function pedir(texto) {
    const limpio = String(texto || "").trim();
    if (!limpio || ocupado) return;
    conversacion = [...conversacion, { rol: "profesor", texto: limpio }];
    input.value = "";
    setOcupado(true);
    try {
      const r = await interpretarFn({ conversacion, contexto: getContexto() });
      if (r.accion === "hoja") {
        cerrarConversacion();
        onHoja(r.plan, r.explicacion);
      } else if (r.accion === "ejercicio") {
        cerrarConversacion();
        onEjercicio(r.clave, r.explicacion);
      } else if (r.accion === "pregunta") {
        // La pregunta entra en la conversación: la siguiente respuesta del
        // profesor se entiende con ella delante.
        conversacion = [...conversacion, { rol: "asistente", texto: r.pregunta }];
        mostrar(r.pregunta, (r.opciones || []).map((o) => boton(o, "ghost", () => pedir(o))));
        input.focus();
      } else if (r.accion === "fuera_de_catalogo") {
        // Jorge, 23/9: avisar de que no es de este tema y pedir confirmación.
        // Generar FUERA del catálogo es la fase 3 y no existe todavía, así que
        // "seguir igualmente" lo dice en vez de fingir que lo hace.
        const botones = [];
        if (r.parecido) {
          botones.push(boton("Usar lo más parecido", "copper", () => { cerrarConversacion(); onHoja(r.parecido, ""); }));
        }
        botones.push(boton("Seguir igualmente", "ghost", () => mostrar(
          "Todavía no genero ejercicios que no están en el catálogo: llegará en la fase 3, con las soluciones "
          + "comprobadas por el programa. Mientras tanto, elige algo del catálogo.",
          [boton("Vale", "ghost", cerrarConversacion)],
        )));
        botones.push(boton("Cancelar", "ghost", cerrarConversacion));
        mostrar(`${r.explicacion || "Eso no está en este tema."} ¿Quieres seguir?`, botones);
      }
    } catch (err) {
      conversacion = conversacion.slice(0, -1);
      input.value = limpio;
      mostrar(err?.message || "No se ha podido entender el pedido.", [], { error: true });
    } finally {
      setOcupado(false);
    }
  }

  enviar.addEventListener("click", () => pedir(input.value));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") pedir(input.value); });

  // Dictar rellena la caja; se envía al terminar de hablar, como en el
  // tutor: dictar y luego tener que pulsar "Pedir" es un paso de más.
  const dictado = createDictado({
    win,
    onTexto: (texto) => { input.value = texto; },
    onFin: () => {
      mic.classList.remove("ej-pedido-mic--on");
      mic.textContent = "Dictar";
      if (input.value.trim()) pedir(input.value);
    },
    onError: (m) => mostrar(m, [], { error: true }),
  });
  mic.addEventListener("click", () => {
    if (dictado.activo) { dictado.parar(); return; }
    if (dictado.empezar()) {
      mic.classList.add("ej-pedido-mic--on");
      mic.textContent = "Escuchando… (parar)";
    }
  });

  placeholder();
  return {
    el: wrap,
    // Al elegir o soltar un ejercicio, la caja cambia de "pide una hoja" a
    // "describe el que quieres en su lugar", y la conversación empieza de 0.
    refrescar() { placeholder(); cerrarConversacion(); },
    setOcupado,
  };
}
