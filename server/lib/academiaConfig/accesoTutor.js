// ¿Ha repartido este centro el tutor IA a sus alumnos?
//
// Un solo valor (academia_config.acceso_tutor_activo, migración 105) decide
// dos cosas del alta de alumno que antes iban siempre juntas y encendidas:
//   - si el email del alumno es obligatorio para guardar,
//   - si se le crea cuenta en auth.users y se le envía la invitación.
//
// Se lee en un helper propio, y no en línea en la ruta, porque el fallo
// tiene que ser conservador y en un único sitio: si la consulta falla o el
// centro todavía no tiene fila de configuración, se devuelve `false`. Es
// decir, ante la duda NO se crean cuentas ni se envían correos a alumnos —
// un email de más no se puede retirar, y un alumno guardado sin acceso se
// arregla encendiendo el interruptor y volviendo a guardar.
export async function fetchAccesoTutorActivo(admin, tenantId) {
  const { data, error } = await admin
    .from("academia_config")
    .select("acceso_tutor_activo")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return false;
  return data?.acceso_tutor_activo === true;
}
