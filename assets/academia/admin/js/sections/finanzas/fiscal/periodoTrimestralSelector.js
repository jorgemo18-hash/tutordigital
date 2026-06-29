// Selector año + trimestre para la pestaña Fiscal — mismo patrón que
// periodoSelector.js (envioFamilias, mes+año), pero con trimestre en vez
// de mes porque los modelos 130/115/111 son trimestrales.
function buildSelectAnio(anioSeleccionado, anioActualSistema) {
  const select = document.createElement("select");
  select.className = "ac-select";
  for (let a = 2024; a <= anioActualSistema + 2; a += 1) {
    const opt = document.createElement("option");
    opt.value = String(a);
    opt.textContent = String(a);
    opt.selected = a === anioSeleccionado;
    select.appendChild(opt);
  }
  return select;
}

function buildSelectTrimestre(trimestreSeleccionado) {
  const select = document.createElement("select");
  select.className = "ac-select";
  for (let t = 1; t <= 4; t += 1) {
    const opt = document.createElement("option");
    opt.value = String(t);
    opt.textContent = `T${t}`;
    opt.selected = t === trimestreSeleccionado;
    select.appendChild(opt);
  }
  return select;
}

export function trimestreActual() {
  const hoy = new Date();
  return { anio: hoy.getFullYear(), trimestre: Math.floor(hoy.getMonth() / 3) + 1 };
}

export function buildPeriodoTrimestralSelector({ anio, trimestre, anioActualSistema, onChange }) {
  const wrap = document.createElement("div");
  wrap.className = "ac-fiscal-periodo-selector";

  const selectTrimestre = buildSelectTrimestre(trimestre);
  const selectAnio = buildSelectAnio(anio, anioActualSistema);

  const notificar = () => onChange({ anio: Number(selectAnio.value), trimestre: Number(selectTrimestre.value) });
  selectTrimestre.addEventListener("change", notificar);
  selectAnio.addEventListener("change", notificar);

  wrap.append(selectTrimestre, selectAnio);
  return wrap;
}
