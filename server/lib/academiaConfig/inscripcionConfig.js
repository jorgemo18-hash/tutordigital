// Defaults de la hoja de inscripción (pestaña Ajustes › Inscripción) —
// replican la hoja actual de Lyceo: todo activo salvo fecha de nacimiento,
// DNI y teléfono del alumno, y el bloque de autorizaciones. Única fuente
// de verdad del shape — la usan academia.config.routes.js (GET/PUT) y
// generarHojaInscripcion.js (payload al microservicio), para no definir el
// mismo objeto dos veces.
export const INSCRIPCION_CONFIG_DEFAULTS = {
  alumno: {
    fecha_nacimiento: false,
    dni: false,
    curso: true,
    email: true,
    telefono: false,
  },
  familia: {
    activo: true,
    nombre_tutor: true,
    apellidos: true,
    dni: true,
    direccion: true,
    codigo_postal: true,
    telefono: true,
    email: true,
  },
  metodo_pago: {
    activo: true,
    domiciliado: true,
    transferencia: true,
    bizum: true,
    efectivo: true,
  },
  preferencia_cobro: {
    activo: true,
  },
  autorizaciones: {
    activo: false,
    salida_sin_acompanante: false,
  },
};

// Rellena con defaults cualquier bloque/campo ausente — necesario para
// tenants que nunca han tocado esta pestaña (columna null) y defensivo
// ante configs guardadas con un shape más viejo si el formulario cambia.
export function resolverInscripcionConfig(raw) {
  if (!raw || typeof raw !== "object") return INSCRIPCION_CONFIG_DEFAULTS;
  const resultado = {};
  for (const [bloque, campos] of Object.entries(INSCRIPCION_CONFIG_DEFAULTS)) {
    resultado[bloque] = { ...campos, ...(raw[bloque] || {}) };
  }
  return resultado;
}
