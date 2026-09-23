// "ESE CÓDIGO YA ES DE OTRO ALUMNO."
//
// Quien impide de verdad el duplicado es la base de datos (índice único
// `academia_alumnos_codigo_unico`, migración 124), y tiene que ser así: una
// comprobación previa desde el servidor —mirar si existe y luego insertar—
// deja un hueco entre las dos operaciones por el que se cuelan dos altas
// simultáneas, y además no cubre un PATCH hecho desde fuera de la pantalla.
//
// Lo que hace falta entonces es TRADUCIR ese error. Sin esto, PostgreSQL
// devuelve un 23505 con el nombre del índice, el backend lo trata como fallo
// inesperado y el admin ve un 500 y un toast genérico: sabe que no se ha
// guardado, no sabe por qué ni qué campo tocar.
//
// Se mira el CÓDIGO 23505 y el nombre del índice, no el texto del mensaje: el
// texto cambia con la versión y con el idioma del servidor, y hay otros
// índices únicos en la tabla cuyo choque no se debe contar como este.

export const INDICE_CODIGO_ALUMNO = "academia_alumnos_codigo_unico";

export const MENSAJE_CODIGO_REPETIDO = "Ese código ya es de otro alumno de la academia.";

export function esCodigoRepetido(error) {
  if (!error) return false;
  if (error.code !== "23505") return false;
  // PostgREST reparte el nombre del índice entre `message` y `details` según
  // el caso, así que se miran los dos. `constraint` existe en algunos
  // clientes y es el más fiable cuando está.
  const donde = [error.constraint, error.message, error.details]
    .filter((x) => typeof x === "string")
    .join(" ");
  return donde.includes(INDICE_CODIGO_ALUMNO);
}
