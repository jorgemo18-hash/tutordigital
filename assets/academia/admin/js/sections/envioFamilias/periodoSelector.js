const MESES = [
  null, "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function buildSelectAnio(anioSeleccionado, anioActualSistema) {
  const select = document.createElement("select");
  select.className = "ac-select ef-selector-anio";
  for (let a = 2024; a <= anioActualSistema + 2; a += 1) {
    const opt = document.createElement("option");
    opt.value = String(a);
    opt.textContent = String(a);
    opt.selected = a === anioSeleccionado;
    select.appendChild(opt);
  }
  return select;
}

// Meses con al menos un recibo enviado ese año se marcan con "✓" — un
// <select> nativo no admite estilos por <option>, así que el indicador va
// en el propio texto.
function buildSelectMes(mesSeleccionado, mesesEnviados) {
  const select = document.createElement("select");
  select.className = "ac-select ef-selector-mes-desplegable";
  for (let m = 1; m <= 12; m += 1) {
    const opt = document.createElement("option");
    opt.value = String(m);
    opt.textContent = mesesEnviados.includes(m) ? `${MESES[m]} ✓` : MESES[m];
    opt.selected = m === mesSeleccionado;
    select.appendChild(opt);
  }
  return select;
}

// Dos desplegables (mes + año) en vez de un <input type="month">. `onChange`
// recibe siempre el período completo {mes, anio}, leyendo el valor del otro
// selector en el momento del cambio.
export function buildPeriodoSelector({ mes, anio, mesesEnviados = [], anioActualSistema, onChange }) {
  const wrap = document.createElement("div");
  wrap.className = "ef-periodo-selector";

  const selectMes = buildSelectMes(mes, mesesEnviados);
  const selectAnio = buildSelectAnio(anio, anioActualSistema);

  const notificar = () => onChange({ mes: Number(selectMes.value), anio: Number(selectAnio.value) });
  selectMes.addEventListener("change", notificar);
  selectAnio.addEventListener("change", notificar);

  wrap.append(selectMes, selectAnio);
  return wrap;
}
