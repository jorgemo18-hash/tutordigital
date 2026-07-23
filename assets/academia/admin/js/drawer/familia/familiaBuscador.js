// Buscador de familias existentes por nombre de la familia o email — usado al
// pulsar "+ Vincular a hermano/a". `familias` ya viene cargado (GET
// /academia/familias); el filtrado es en cliente.
export function buildBuscadorFamilias(familias, onPick) {
  const wrap = document.createElement("div");

  const searchWrap = document.createElement("div");
  searchWrap.className = "ac-search";
  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = "Buscar por nombre o email…";
  searchWrap.appendChild(input);

  const lista = document.createElement("div");
  lista.className = "ac-familia-buscador-lista";

  function renderResultados() {
    const q = input.value.trim().toLowerCase();
    const filtradas = q
      ? familias.filter((f) => (f.nombre || "").toLowerCase().includes(q) || (f.email || "").toLowerCase().includes(q))
      : familias;

    lista.innerHTML = "";
    if (!filtradas.length) {
      const p = document.createElement("p");
      p.className = "ac-empty";
      p.textContent = "Sin resultados.";
      lista.appendChild(p);
      return;
    }
    for (const f of filtradas) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "ac-familia-buscador-row";
      const nombre = document.createElement("span");
      nombre.className = "ac-familia-buscador-row-nombre";
      nombre.textContent = f.nombre || "(sin nombre)";
      row.appendChild(nombre);
      if (f.email) {
        const email = document.createElement("span");
        email.className = "ac-familia-buscador-row-email";
        email.textContent = f.email;
        row.appendChild(email);
      }
      row.addEventListener("click", () => onPick(f));
      lista.appendChild(row);
    }
  }

  input.addEventListener("input", renderResultados);
  renderResultados();

  wrap.append(searchWrap, lista);
  return wrap;
}
