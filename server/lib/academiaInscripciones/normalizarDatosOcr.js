// Normaliza lo que devuelve el OCR de una ficha de inscripción a la forma
// que consume el drawer de alumno: { alumno: {...}, familia: {...} }.
//
// Vive en el servidor, no en el navegador, porque es donde se puede probar
// sin montar el DOM y porque así el cliente recibe siempre la misma forma
// pase lo que pase con el modelo.
//
// Tres cosas de las que se ocupa:
//
// 1. TOLERANCIA AL FORMATO ANTIGUO. El prompt anterior devolvía un objeto
//    plano ({nombre, email, telefono, dni, direccion...}) sin distinguir
//    alumno de tutor. Un modelo puede seguir devolviendo eso ante una ficha
//    rara. En ese caso se reparte con el mismo criterio que tenía el código
//    antiguo (el nombre al alumno) pero, a diferencia de antes, el dni y la
//    dirección van a la familia — que es de quien son en la hoja real.
//
// 2. NOMBRE DE LA FAMILIA. La hoja pide nombre y apellidos del tutor por
//    separado; academia_familias tiene una sola columna `nombre`. Se unen
//    aquí en vez de en el formulario, para que el mismo criterio valga para
//    cualquier consumidor futuro.
//
// 3. MÉTODO DE PAGO. La hoja dice "sepa"; la base de datos usa
//    "domiciliado" (ver el CHECK de academia_familias.metodo_pago). La
//    traducción estaba en el drawer (METODO_PAGO_OCR en alumnoDrawer.js) y
//    se mueve aquí: es una regla del dato, no de la interfaz.

const METODO_PAGO_EQUIVALENCIAS = { sepa: "domiciliado" };
const METODOS_PAGO_VALIDOS = new Set(["bizum", "domiciliado", "transferencia", "efectivo"]);

function texto(valor) {
  const limpio = String(valor ?? "").trim();
  return limpio || "";
}

// Un campo vacío nunca debe pisar lo que el admin ya haya escrito, así que
// las claves sin valor se omiten en vez de viajar como "".
function soloConValor(objeto) {
  return Object.fromEntries(Object.entries(objeto).filter(([, valor]) => valor !== ""));
}

export function normalizarMetodoPago(valor) {
  const bruto = texto(valor).toLowerCase();
  if (!bruto) return "";
  const equivalente = METODO_PAGO_EQUIVALENCIAS[bruto] || bruto;
  return METODOS_PAGO_VALIDOS.has(equivalente) ? equivalente : "";
}

export function unirNombreTutor(nombreTutor, apellidos) {
  return [texto(nombreTutor), texto(apellidos)].filter(Boolean).join(" ");
}

export function normalizarDatosInscripcion(raw) {
  const datos = raw && typeof raw === "object" ? raw : {};
  const tieneFormatoNuevo = Boolean(datos.alumno || datos.familia);

  // Formato antiguo/plano: un solo juego de campos, sin distinguir bloques.
  const plano = tieneFormatoNuevo ? {} : datos;
  const alumnoRaw = tieneFormatoNuevo ? datos.alumno || {} : plano;
  const familiaRaw = tieneFormatoNuevo ? datos.familia || {} : plano;

  const alumno = soloConValor({
    nombre: texto(alumnoRaw.nombre),
    curso: texto(alumnoRaw.curso),
    // En el formato plano el email/teléfono único se atribuía al alumno y
    // el email además se copiaba a la familia — se mantiene ese reparto
    // para no cambiar el comportamiento ante una respuesta antigua.
    email: texto(alumnoRaw.email),
    telefono: texto(alumnoRaw.telefono),
    direccion: tieneFormatoNuevo ? texto(alumnoRaw.direccion) : "",
    ciudad: tieneFormatoNuevo ? texto(alumnoRaw.ciudad) : "",
    codigo_postal: tieneFormatoNuevo ? texto(alumnoRaw.codigo_postal) : "",
  });

  const familia = soloConValor({
    nombre: tieneFormatoNuevo
      ? unirNombreTutor(familiaRaw.nombre_tutor, familiaRaw.apellidos)
      : "",
    dni: texto(familiaRaw.dni),
    email: texto(familiaRaw.email),
    telefono: tieneFormatoNuevo ? texto(familiaRaw.telefono) : "",
    direccion: texto(familiaRaw.direccion),
    ciudad: texto(familiaRaw.ciudad),
    codigo_postal: texto(familiaRaw.codigo_postal),
    metodo_pago: normalizarMetodoPago(datos.metodo_pago),
  });

  return { alumno, familia };
}
