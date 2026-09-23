// CAMBIAR DE SITIO UN EJERCICIO ARRASTRANDO SU ASA (≡). Jorge, 23/9: *"a la
// izquierda de cada ejercicio una barrita que permita moverlo de orden"*.
//
// Arrastre nativo del navegador (el mismo en Chrome y Safari de escritorio).
// Solo arrastra quien coge el ASA: una fila entera arrastrable robaría la
// selección de texto y los clics en Cambiar y Quitar. Mientras se arrastra,
// una línea marca dónde caerá (encima o debajo de la fila que se sobrevuela).
//
// El teclado va por otro lado (flechas sobre el asa, ver listaDeHuecos.js):
// arrastrar no es la única forma de ordenar.
//
// `onMover(de, a)` recibe posiciones desde 0, como mueveActividad.
export function destinoAlSoltar(de, sobre, debajo) {
  // Posición final tras sacar `de` de la lista.
  let a = debajo ? sobre + 1 : sobre;
  if (de < a) a -= 1;
  return a;
}

export function hacerOrdenable({ lista, onMover }) {
  let de = null;

  const filas = () => [...lista.querySelectorAll(".rc-slot")];
  const limpiar = () => filas().forEach((f) => f.classList.remove("is-antes", "is-despues", "is-arrastrando"));
  const indiceDe = (f) => Number(f.dataset.orden) - 1;

  for (const f of filas()) {
    const asa = f.querySelector(".rc-slot__asa");
    // La fila solo es arrastrable mientras se tiene cogida el asa.
    asa?.addEventListener("pointerdown", () => { f.draggable = true; });
    asa?.addEventListener("pointerup", () => { f.draggable = false; });

    f.addEventListener("dragstart", (e) => {
      de = indiceDe(f);
      f.classList.add("is-arrastrando");
      try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(de + 1)); } catch { /* sin datos */ }
    });
    f.addEventListener("dragend", () => { f.draggable = false; de = null; limpiar(); });

    f.addEventListener("dragover", (e) => {
      if (de == null) return;
      e.preventDefault();
      const r = f.getBoundingClientRect();
      const debajo = e.clientY > r.top + r.height / 2;
      filas().forEach((x) => x.classList.remove("is-antes", "is-despues"));
      f.classList.add(debajo ? "is-despues" : "is-antes");
    });

    f.addEventListener("drop", (e) => {
      if (de == null) return;
      e.preventDefault();
      const debajo = f.classList.contains("is-despues");
      const a = destinoAlSoltar(de, indiceDe(f), debajo);
      const origen = de;
      de = null;
      limpiar();
      if (a !== origen) onMover(origen, a);
    });
  }
  return { get arrastrando() { return de; } };
}
