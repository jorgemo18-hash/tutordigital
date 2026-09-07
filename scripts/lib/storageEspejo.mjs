import { statSync } from "node:fs";
import { listarObjetos, esCarpeta } from "./storageMover.mjs";

// Copiar Supabase Storage a una carpeta local, y mantenerla al día.
//
// POR QUÉ UN ESPEJO Y NO UNA COPIA NUEVA CADA SEMANA. Son 135 MB que casi no
// cambian: una ficha se sube una vez y se queda ahí para siempre. Guardar
// doce copias completas serían 1,6 GB de lo mismo, y cada lunes media hora
// bajando fotos que ya están. Aquí se baja SOLO lo que falta o ha cambiado,
// y la primera vez se baja todo.
//
// LO QUE SE BORRA EN SUPABASE NO SE BORRA AQUÍ. Es una copia de seguridad:
// si alguien borra una ficha por error, el lunes siguiente el espejo tiene
// que seguir teniéndola. Los archivos que ya no están en el servidor se
// listan aparte, para que se vea que están de más y no que faltan.
//
// LA FECHA DEL ARCHIVO LOCAL ES LA DEL REMOTO. Se copia con utimes al
// terminar la descarga, y así el propio sistema de archivos hace de registro:
// no hace falta un manifiesto aparte que se pueda corromper o desincronizar.

// Un archivo del espejo, a partir del bucket y su ruta dentro de él. Nunca se
// concatena a mano en el resto del código: una ruta con ".." dentro sacaría
// la escritura de la carpeta de copias.
export function rutaLocalDe(destino, bucket, ruta) {
  const limpia = String(ruta)
    .split("/")
    .filter((t) => t && t !== "." && t !== "..")
    .join("/");
  return `${destino}/${bucket}/${limpia}`;
}

// ¿Hay que bajarlo? Sí si no está, si el tamaño no coincide, o si el remoto
// es más nuevo que la copia.
//
// El tamaño solo no basta: una ficha reemplazada por otra foto del mismo
// tamaño existe. La fecha sola tampoco: un archivo a medio bajar tiene la
// fecha bien y el tamaño mal. Se miran las dos.
export function hayQueDescargar({ local, bytesRemotos, actualizadoRemoto }) {
  if (!local) return true;
  if (typeof bytesRemotos === "number" && local.bytes !== bytesRemotos) return true;
  if (!actualizadoRemoto) return false;
  const remoto = Date.parse(actualizadoRemoto);
  if (!Number.isFinite(remoto)) return false;
  // Un segundo de margen: los sistemas de archivos no siempre guardan los
  // milisegundos, y sin margen el mismo archivo se bajaría cada semana.
  return remoto > local.mtimeMs + 1000;
}

export function estadoLocal(ruta) {
  try {
    const st = statSync(ruta);
    return { bytes: st.size, mtimeMs: st.mtimeMs };
  } catch {
    return null;
  }
}

function tamanoDe(entrada) {
  const bruto = entrada?.metadata?.size;
  return typeof bruto === "number" ? bruto : null;
}

// Todos los objetos de un bucket, entrando en las carpetas. Storage no tiene
// carpetas de verdad —son prefijos— pero `list` se comporta como si las
// tuviera, así que hay que bajar nivel a nivel.
//
// `profundidadMax` es una red contra un bucle: una respuesta rara del
// servidor que devolviera siempre la misma carpeta dejaría el backup dando
// vueltas para siempre en mitad de la noche, sin que nadie lo vea.
export async function listarBucketEntero(admin, bucket, { prefijo = "", profundidadMax = 12 } = {}) {
  if (profundidadMax <= 0) return { ok: false, motivo: `demasiados niveles bajo "${prefijo}"` };

  const listado = await listarObjetos(admin, bucket, prefijo);
  if (!listado.ok) return { ok: false, motivo: listado.motivo };

  const objetos = [];
  for (const entrada of listado.entradas) {
    const ruta = prefijo ? `${prefijo}/${entrada.name}` : entrada.name;
    if (!esCarpeta(entrada)) {
      objetos.push({ ruta, bytes: tamanoDe(entrada), actualizado: entrada.updated_at || entrada.created_at || null });
      continue;
    }
    const dentro = await listarBucketEntero(admin, bucket, { prefijo: ruta, profundidadMax: profundidadMax - 1 });
    if (!dentro.ok) return dentro;
    objetos.push(...dentro.objetos);
  }
  return { ok: true, objetos };
}
