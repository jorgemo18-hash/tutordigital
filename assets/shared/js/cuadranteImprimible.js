// EL CUADRANTE PARA PAPEL: una tabla de días, horas y nombres.
//
// Pedido por Jorge el 16/09/2026, después de intentar imprimirlo:
// *"al imprimir el horario en vertical sale bien, pero en horizontal se corta
// y si le bajo la escala no aparece lo cortado, tampoco aparece en dos
// hojas... es como si desapareciera. Podríamos simplificar lo que se imprime,
// tipo la foto, solo días, horas y nombres"*.
//
// ESTO CORRIGE UNA DECISIÓN MÍA DEL 14/09. Entonces escribí que se imprimía
// "lo que hay en pantalla, no una versión aparte", para que no hubiera dos
// dibujos que se desincronizaran. El razonamiento era bueno y la conclusión
// era mala, porque las dos rejillas de pantalla son CAJAS CON SCROLL:
//
//   .ac-grid        { overflow-y: auto }   (cuadrante del aula)
//   .ach-rejilla-wrap { overflow-x: auto } (cuadrante del centro)
//
// Una caja con scroll no se puede imprimir: el navegador saca la parte
// visible y lo demás no se corta "mal", desaparece — y no pasa a un segundo
// folio porque una caja con scroll no se puede partir. Por eso bajar la
// escala no servía de nada: la caja sigue recortando por donde recortaba.
// Eso es exactamente lo que Jorge estaba viendo, y no se arregla con CSS de
// impresión: se arregla no imprimiendo una caja con scroll.
//
// UNA TABLA DE VERDAD (`<table>`) es lo contrario: el navegador la parte
// entre folios él solo y repite la cabecera, y el ancho se reparte entre las
// columnas en vez de desbordarse.
//
// LO QUE NO SE DESINCRONIZA: las filas y el reparto de alumnos salen de
// `repartirEnBloques` (horarioBloques.js), la MISMA función que pinta las dos
// rejillas y que calcula la hoja de las familias. Lo que cambia es solo cómo
// se dibuja una celda. Si algún día cambia cómo se reparten las clases,
// cambia en un sitio y llega a los cuatro.

import { etiquetaFranja, repartirEnBloques } from "./horarioBloques.js";
import { nombrePila } from "./nombrePila.js";
import { hoyYMD, textoDesde } from "./desdeFecha.js";

const NOMBRES_DIA = {
  1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves",
  5: "Viernes", 6: "Sábado", 7: "Domingo",
};

// Los dos paneles llaman con formas distintas: el del aula ya tiene
// [{value, name}] y el del centro tiene [1,2,3,4,5]. Se normaliza aquí en vez
// de obligar a uno de los dos a cambiar su forma por esto.
export function normalizarDias(dias = []) {
  return (dias || []).map((d) =>
    typeof d === "object" && d !== null
      ? { value: d.value, name: d.name || NOMBRES_DIA[d.value] || `Día ${d.value}` }
      : { value: d, name: NOMBRES_DIA[d] || `Día ${d}` }
  );
}

// El nombre de un alumno en el papel: el de pila, como en el cuadrante de
// pantalla y como en el cuaderno de Jorge.
//
// CON UNA EXCEPCIÓN QUE EN PANTALLA NO HACE FALTA: si en la misma casilla hay
// dos nombres de pila iguales, se añade la inicial del apellido ("Daniel A." /
// "Daniel E."). En pantalla se distinguen pasando el ratón por encima; en un
// folio no hay ratón, y dos "Daniel" en la misma hora es justo el sitio donde
// importa saber cuál de los dos.
export function nombresDeCelda(franjas = []) {
  const completos = franjas.map((f) => String(f?.alumno?.nombre || "").trim());
  const cuenta = new Map();
  for (const completo of completos) {
    const pila = nombrePila(completo);
    if (!cuenta.has(pila)) cuenta.set(pila, new Set());
    cuenta.get(pila).add(completo);
  }
  return completos.map((completo) => {
    const pila = nombrePila(completo) || "(sin nombre)";
    if ((cuenta.get(pila)?.size || 0) < 2) return pila;
    const inicial = completo.split(/\s+/)[1]?.[0];
    return inicial ? `${pila} ${inicial.toUpperCase()}.` : pila;
  });
}

// Las marcas que van entre paréntesis detrás del nombre. Son las dos cosas
// que, si no se dicen, hacen que el papel mienta:
//
//   - LA HORA, cuando el alumno no ocupa la fila entera (los de "y en punto").
//     Sin ella, alguien que viene de 16:00 a 17:00 parece que viene de 15:30.
//   - "desde 1/10", cuando tiene la plaza pero todavía no viene. Decisión de
//     Jorge del 11/09 ("sí, que se vea"): la plaza está comprometida, pero
//     quien esté hoy en el aula es otra cosa. En pantalla es una pastilla;
//     aquí, texto, porque el papel no tiene sitio para pastillas.
//
// El resto —curso, etapa, color, contador— se queda fuera: *"solo días, horas
// y nombres"*. Y no es solo por obediencia: los contadores y las etiquetas de
// curso son lo que hacía que el cuadrante no cupiera.
function marcasDe(franja, { esSuelta = false, hoyISO } = {}) {
  const marcas = [];
  if (esSuelta) marcas.push(etiquetaFranja(franja));
  const desde = textoDesde(franja?.fecha_inicio, hoyISO);
  if (desde) marcas.push(desde);
  return marcas;
}

function textoDeAlumno(franja, nombre, opciones) {
  const marcas = marcasDe(franja, opciones);
  return marcas.length ? `${nombre} (${marcas.join(", ")})` : nombre;
}

// El contenido de una casilla, ya en texto. Separador " / " como en la hoja
// de cálculo que Jorge lleva usando: en una celda estrecha, las comas se
// confunden con las de un nombre compuesto.
export function textoDeCelda(celda = {}, { hoyISO = hoyYMD() } = {}) {
  const { dentro = [], sueltas = [] } = celda;
  const nombresDentro = nombresDeCelda(dentro);
  const nombresSueltas = nombresDeCelda(sueltas);
  const partes = [
    ...dentro.map((f, i) => textoDeAlumno(f, nombresDentro[i], { hoyISO })),
    ...sueltas.map((f, i) => textoDeAlumno(f, nombresSueltas[i], { esSuelta: true, hoyISO })),
  ];
  return partes.join(" / ");
}

// El modo "enseñar a una familia": plazas libres y ningún nombre. Es el mismo
// interruptor de la pantalla, y se respeta en el papel porque el caso de uso
// es precisamente imprimirlo para dárselo a alguien.
export function textoDePlazas(celda = {}, maxPorFranja = 0) {
  const { ocupacion = 0 } = celda;
  if (!maxPorFranja) return "";
  const libres = Math.max(0, maxPorFranja - ocupacion);
  if (libres === 0) return "Completo";
  return `${libres} ${libres === 1 ? "plaza" : "plazas"}`;
}

export function buildTablaImprimible({
  franjas = [],
  dias = [],
  bloques = [],
  maxPorFranja = 0,
  sinNombres = false,
  titulo = "",
  hoyISO = hoyYMD(),
  doc = globalThis.document,
} = {}) {
  const columnas = normalizarDias(dias);
  const wrap = doc.createElement("section");
  // ac-print-solo: no se ve en pantalla, existe solo para el papel.
  wrap.className = "ac-print-solo cq-hoja";

  if (titulo) {
    const h = doc.createElement("h2");
    h.className = "cq-titulo";
    h.textContent = titulo;
    wrap.appendChild(h);
  }

  if (!bloques.length || !columnas.length) {
    const vacio = doc.createElement("p");
    vacio.className = "cq-vacio";
    vacio.textContent = "No hay franjas configuradas para este horario.";
    wrap.appendChild(vacio);
    return wrap;
  }

  const tabla = doc.createElement("table");
  tabla.className = "cq-tabla";

  const thead = doc.createElement("thead");
  const filaCab = doc.createElement("tr");
  const esquina = doc.createElement("th");
  esquina.className = "cq-hora";
  esquina.textContent = "Hora";
  filaCab.appendChild(esquina);
  for (const col of columnas) {
    const th = doc.createElement("th");
    th.textContent = col.name;
    filaCab.appendChild(th);
  }
  thead.appendChild(filaCab);
  tabla.appendChild(thead);

  // El reparto, por día, con la misma función que las rejillas de pantalla.
  const reparto = new Map(
    columnas.map((col) => [
      col.value,
      repartirEnBloques((franjas || []).filter((f) => f.dia_semana === col.value), bloques),
    ])
  );

  const tbody = doc.createElement("tbody");
  bloques.forEach((bloque, fila) => {
    const tr = doc.createElement("tr");
    const hora = doc.createElement("th");
    hora.className = "cq-hora";
    // Las dos horas, como en pantalla: con filas que empiezan y media, solo
    // la de inicio obliga a reconstruir de cabeza dónde acaba la clase.
    hora.textContent = `${bloque.inicio}–${bloque.fin}`;
    tr.appendChild(hora);

    for (const col of columnas) {
      const celda = reparto.get(col.value)?.[fila] || {};
      const td = doc.createElement("td");
      const texto = sinNombres
        ? textoDePlazas(celda, maxPorFranja)
        : textoDeCelda(celda, { hoyISO });
      if (!texto) td.className = "cq-vacia";
      td.textContent = texto;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });

  tabla.appendChild(tbody);
  wrap.appendChild(tabla);
  return wrap;
}
