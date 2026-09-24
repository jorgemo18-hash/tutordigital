// EL CORREO DEL BACKUP: qué dice y cómo se manda.
//
// POR QUÉ UN CORREO (roadmap, «Que el backup avise por email»): la
// notificación de macOS se pierde con la pantalla bloqueada o el portátil
// cerrado, y un aviso que no se ve es como no tenerlo. El correo llega
// siempre, y además se manda TAMBIÉN cuando sale bien: así la señal de que
// algo va mal es que el correo del lunes NO llegue — que es justo lo que
// ninguna notificación puede decir (si la tarea deja de ejecutarse, no
// notifica nada).
//
// Se manda con la API de Resend (la misma cuenta que usa la app para los
// recibos) por HTTP y sin el SDK: son diez líneas, y así `fetch` se puede
// sustituir en los tests.

export const ESTADOS = ["ok", "fallo", "aviso"];

const ASUNTO = {
  ok: "[TutorDigital] Copia de seguridad hecha",
  aviso: "[TutorDigital] Copia de seguridad hecha, con un aviso",
  fallo: "[TutorDigital] LA COPIA DE SEGURIDAD HA FALLADO",
};

const QUE_HACER = {
  ok: "No hay que hacer nada. Si un lunes no te llega este correo, la tarea automática ha dejado de funcionar: mira el Mac.",
  aviso: "La copia de la base de datos está hecha, pero algo no ha ido del todo bien. Mira el detalle.",
  fallo: "Esta semana NO hay copia nueva. Mira el log en el Mac y vuelve a lanzarla a mano: ./scripts/backup-db-programado.sh",
};

export function correoDeBackup({ estado, mensaje, ahora = new Date(), equipo = "" }) {
  if (!ESTADOS.includes(estado)) throw new Error(`estado desconocido: ${estado}`);
  const cuando = ahora.toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
  const lineas = [
    mensaje,
    "",
    QUE_HACER[estado],
    "",
    `Fecha: ${cuando}${equipo ? ` · Equipo: ${equipo}` : ""}`,
  ];
  return { asunto: ASUNTO[estado], texto: lineas.join("\n") };
}

// Qué falta para poder mandarlo. Sin correo configurado el backup NO falla:
// solo se dice, y la notificación de macOS sigue saliendo.
export function configuracionDelAviso(env) {
  const faltan = ["RESEND_API_KEY", "BACKUP_AVISO_EMAIL"].filter((k) => !env[k]);
  if (faltan.length) return { ok: false, faltan };
  return {
    ok: true,
    apiKey: env.RESEND_API_KEY,
    para: env.BACKUP_AVISO_EMAIL,
    de: env.BACKUP_AVISO_REMITENTE || "TutorDigital <noreply@tutordigital.app>",
  };
}

export async function enviarCorreo({ config, correo, fetchFn = fetch }) {
  const res = await fetchFn("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: config.de, to: [config.para], subject: correo.asunto, text: correo.texto }),
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    return { ok: false, motivo: `Resend contestó ${res.status}: ${detalle.slice(0, 200)}` };
  }
  return { ok: true };
}
