import { buildIcon } from "../../icons.js";

// El aviso de "hay familias sin email" en Envío a familias.
//
// POR QUÉ EXISTE (11/09/2026). Hasta hoy, crear una familia EXIGÍA su email,
// y por eso este caso no podía darse. La exigencia se ha levantado por un
// motivo concreto de Jorge: *"me ha llamado gente que ya tengo inscrita, sé
// que van a venir"* — cuando le llaman se queda con el nombre y un móvil;
// cuando le escriben, con el email. Exigir el email dejaba a esos alumnos
// atascados en Borradores, fuera del horario y del diario, con el alumno ya
// viniendo a clase.
//
// POR QUÉ SE RELAJÓ EL EMAIL Y NO LA FAMILIA. Era la otra opción — dejar al
// alumno activo sin familia— y es peor: `fetchFamiliasConAlumnos` agrupa por
// familia con un `if (!a.familia_id) continue;`, así que un alumno activo
// sin familia DESAPARECE del lote de recibos en silencio. No es un recibo
// raro que la madre ve: es no facturarle y no enterarse. Con familia y sin
// email, en cambio, el alumno entra entero en el sistema y lo único que
// falta es el canal de envío — que el backend ya maneja
// (enviarFamiliaEmail.js devuelve `sin_email` para esa familia y sigue con
// el resto del lote).
//
// ES EL MISMO PRINCIPIO QUE EL RECIBO DE 0 €: exigir el dato en el momento
// en que hace falta de verdad —al enviar— y no en el de crear. Avisa antes
// del lote, y no bloquea: el centro puede querer imprimir ese recibo o
// mandarlo por WhatsApp.
//
// SE LEE DEL LISTADO QUE YA ESTÁ CARGADO (`familia_email` viene en
// listado.routes.js). Ninguna consulta nueva.

const MAX_NOMBRES = 6;

// Familias del listado sin email. Se mira `familia_email === ""` o ausente:
// el backend devuelve el valor tal cual está en la columna.
export function familiasSinEmail(items = []) {
  return (items || [])
    .filter((item) => !String(item?.familia_email || "").trim())
    .map((item) => ({ id: item.familia_id, nombre: item.familia_nombre || "(sin nombre)" }));
}

// Dice QUÉ pasa y QUÉ va a pasar, como el aviso de los precios: "revisa los
// emails" no informa de nada. Lo que quien lo lee necesita saber es que el
// recibo SÍ se genera —o sea, que el alumno está bien cobrado— y que el
// correo no va a salir.
export function textoAvisoSinEmail(sinEmail = []) {
  if (!sinEmail.length) return "";

  const visibles = sinEmail.slice(0, MAX_NOMBRES).map((f) => f.nombre);
  const restantes = sinEmail.length - visibles.length;
  const lista = restantes > 0 ? `${visibles.join(", ")} y ${restantes} más` : visibles.join(", ");

  return sinEmail.length === 1
    ? `${lista} no tiene email: su recibo se genera, pero no se puede enviar por correo.`
    : `${sinEmail.length} familias no tienen email: ${lista}. Sus recibos se generan, pero no se pueden enviar por correo.`;
}

export function buildAvisoSinEmail(items = []) {
  const sinEmail = familiasSinEmail(items);
  if (!sinEmail.length) return null;

  const aviso = document.createElement("p");
  // Misma pinta que el aviso de precios: los dos son "mira esto antes de
  // pulsar Generar", y dos estilos distintos para la misma clase de aviso
  // solo harían pensar que uno es más grave que el otro.
  aviso.className = "ef-aviso-sin-precio";
  aviso.setAttribute("role", "status");
  aviso.appendChild(buildIcon("alertTriangle", { size: 14 }));

  const texto = document.createElement("span");
  texto.textContent = textoAvisoSinEmail(sinEmail);
  aviso.appendChild(texto);
  return aviso;
}
