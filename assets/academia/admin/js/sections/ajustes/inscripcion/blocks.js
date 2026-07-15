// Metadatos de bloques/campos de "Campos de la hoja" (etiquetas para
// pintar los interruptores) — las claves deben coincidir exactamente con
// inscripcion_config en el backend (ver
// server/lib/academiaConfig/inscripcionConfig.js) para que el objeto que
// arma camposPanel.js al guardar pase la validación del PUT.
export const BLOQUES = [
  {
    key: "alumno",
    label: "Datos del alumno",
    maestro: false, // nombre y apellidos siempre se imprimen, no hay interruptor de bloque
    nota: "Nombre y apellidos siempre se incluyen",
    campos: [
      { key: "fecha_nacimiento", label: "Fecha de nacimiento" },
      { key: "dni", label: "DNI del alumno" },
      { key: "curso", label: "Curso / nivel" },
      { key: "email", label: "Email del alumno" },
      { key: "telefono", label: "Teléfono del alumno" },
    ],
  },
  {
    key: "familia",
    label: "Datos familia / tutor",
    maestro: true,
    campos: [
      { key: "nombre_tutor", label: "Nombre del padre, madre o tutor" },
      { key: "apellidos", label: "Apellidos" },
      { key: "dni", label: "DNI" },
      { key: "direccion", label: "Dirección" },
      { key: "codigo_postal", label: "Código postal" },
      { key: "telefono", label: "Teléfono de contacto" },
      { key: "email", label: "Email" },
    ],
  },
  {
    key: "metodo_pago",
    label: "Método de pago",
    maestro: true,
    campos: [
      { key: "domiciliado", label: "Domiciliado · IBAN" },
      { key: "transferencia", label: "Transferencia bancaria" },
      { key: "bizum", label: "Bizum" },
      { key: "efectivo", label: "En efectivo" },
    ],
  },
  {
    key: "preferencia_cobro",
    label: "Preferencia de cobro",
    maestro: true,
    campos: [],
  },
  {
    key: "autorizaciones",
    label: "Autorizaciones",
    maestro: true,
    campos: [{ key: "salida_sin_acompanante", label: "Salida del centro sin acompañante" }],
  },
];
