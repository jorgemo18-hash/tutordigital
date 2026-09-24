import crypto from "node:crypto";

// EL HASH DE LOS CÓDIGOS DE INVITACIÓN Y DE GRUPO.
//
// Estaba copiado en CINCO sitios (dos helpers y tres rutas), con la misma
// línea en cada uno. Si una copia cambiaba —otra forma de limpiar el código,
// otro orden de peppers— los códigos creados por un lado dejaban de validar
// por el otro, sin ningún error: simplemente "código no válido".
//
// Dos códigos, dos peppers, y el orden de preferencia es el que ya había
// (se conserva tal cual: cambiarlo invalidaría los códigos ya emitidos si
// las dos variables tuvieran valores distintos):
//   - invitación (alumno y profesor): INVITE_CODE_PEPPER, si no JOIN_CODE_PEPPER
//   - código de grupo:                JOIN_CODE_PEPPER, si no INVITE_CODE_PEPPER
export function pepperDeInvitacion(env = process.env) {
  return env.INVITE_CODE_PEPPER || env.JOIN_CODE_PEPPER || "";
}

export function pepperDeGrupo(env = process.env) {
  return env.JOIN_CODE_PEPPER || env.INVITE_CODE_PEPPER || "";
}

function sha256(texto) {
  return crypto.createHash("sha256").update(texto).digest("hex");
}

export function hashInviteCode(code = "", env = process.env) {
  return sha256(`${pepperDeInvitacion(env)}${String(code).trim()}`);
}

export function hashJoinCode(code = "", env = process.env) {
  return sha256(`${pepperDeGrupo(env)}${String(code).trim()}`);
}
