// QUÉ DICE LA FICHA QUE NO DIGA LO GUARDADO.
//
// DE DÓNDE SALE. Jorge, 23/09/2026: *"he creado un alumno con datos falsos
// para que me salga ya en el horario porque ha empezado, pero no tengo la
// ficha, y cuando me la dan, al subirla no cambia lo que hay"*.
//
// Hasta ahora la foto de un alumno que ya existe se guardaba SIN leerla: los
// datos "ya estaban escritos" y lo que faltaba era el documento. Esa premisa
// es falsa justo en el caso más común de una academia: el alumno empieza
// antes de que llegue el papel, y lo que hay guardado es un apaño.
//
// ESTE ARCHIVO NO PINTA NADA. Compara y devuelve la lista de diferencias;
// la pantalla y la decisión van aparte (dialogoComparaFicha.js). Separado
// porque la comparación es lo que tiene reglas —qué cuenta como distinto,
// qué se marca solo— y es lo único que se puede probar sin navegador.

// Los campos que la ficha en papel puede traer, con el nombre que el admin
// ve en el drawer. El orden es el de la ficha, no el alfabético: leer la
// lista de cambios tiene que parecerse a leer la hoja.
export const CAMPOS_ALUMNO = [
  { campo: "nombre", etiqueta: "Nombre" },
  { campo: "curso", etiqueta: "Curso" },
  { campo: "email", etiqueta: "Email del alumno" },
  { campo: "telefono", etiqueta: "Teléfono del alumno" },
  { campo: "direccion", etiqueta: "Dirección" },
  { campo: "ciudad", etiqueta: "Ciudad" },
  { campo: "codigo_postal", etiqueta: "Código postal" },
];

export const CAMPOS_FAMILIA = [
  { campo: "nombre", etiqueta: "Nombre de la familia" },
  { campo: "dni", etiqueta: "DNI" },
  { campo: "email", etiqueta: "Email de la familia" },
  { campo: "telefono", etiqueta: "Teléfono de la familia" },
  { campo: "direccion", etiqueta: "Dirección" },
  { campo: "ciudad", etiqueta: "Ciudad" },
  { campo: "codigo_postal", etiqueta: "Código postal" },
  { campo: "metodo_pago", etiqueta: "Método de pago" },
  { campo: "codigo_sepa", etiqueta: "IBAN" },
];

const vacio = (valor) => valor == null || String(valor).trim() === "";

// "Juan  Pérez" y "juan pérez" son el mismo nombre escrito de dos maneras, y
// enseñarlos como un cambio haría que la lista de diferencias se llenara de
// ruido — con el ruido, el admin deja de leerla y acepta todo a ciegas, que
// es justo lo que esta pantalla viene a evitar.
//
// Los acentos NO se ignoran: "Martin" y "Martín" son distintos y la ficha
// manuscrita es la que manda sobre cómo se escribe el nombre de alguien.
function mismoValor(a, b) {
  const normal = (v) => String(v ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  return normal(a) === normal(b);
}

// UNA DIFERENCIA POR CAMPO, y solo de lo que la ficha trae.
//
// Un campo que la ficha NO trae nunca aparece: el OCR omite las claves sin
// valor (ver normalizarDatosOcr.js), y tratarlas como "la ficha dice vacío"
// borraría datos buenos porque el reconocimiento no acertó a leer una línea.
//
// `estado` separa dos casos que no merecen la misma confianza:
//
//   - "hueco": lo guardado está vacío. Aceptar no pierde nada, así que viene
//     marcado de serie.
//   - "distinto": hay dos valores y no coinciden. Viene SIN marcar: es el
//     único sitio donde se puede perder un dato bueno, y esa decisión la
//     tiene que tomar una persona mirando. Para el caso de Jorge —cambiarlo
//     casi todo— está el botón de "usar todo lo de la ficha", que es un
//     gesto consciente y uno solo.
export function comparaFicha(actual = {}, leido = {}, campos = CAMPOS_ALUMNO) {
  const diferencias = [];
  for (const { campo, etiqueta } of campos) {
    const valorLeido = leido[campo];
    if (vacio(valorLeido)) continue;
    const valorActual = actual[campo];
    if (vacio(valorActual)) {
      diferencias.push({
        campo, etiqueta, actual: null, leido: valorLeido, estado: "hueco", aceptado: true,
      });
      continue;
    }
    if (mismoValor(valorActual, valorLeido)) continue;
    diferencias.push({
      campo, etiqueta, actual: valorActual, leido: valorLeido, estado: "distinto", aceptado: false,
    });
  }
  return diferencias;
}

// Lo que hay que escribir, a partir de lo que el admin haya marcado. Solo
// las aceptadas: las demás no viajan, ni siquiera con su valor de antes —
// mandar el valor actual como si fuera un cambio ensuciaría el guardado y
// pisaría lo que el admin hubiera editado a mano mientras tanto.
export function valoresAceptados(diferencias = []) {
  return Object.fromEntries(
    diferencias.filter((d) => d.aceptado).map((d) => [d.campo, d.leido]),
  );
}

export function hayDiferencias(alumno = [], familia = []) {
  return alumno.length > 0 || familia.length > 0;
}
