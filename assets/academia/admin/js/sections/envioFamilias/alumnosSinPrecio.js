import { buildIcon } from "../../icons.js";

// El aviso de "hay alumnos activos sin precio puesto" en Envío a familias.
//
// EL FALLO QUE ARREGLA. El lote de recibos recorre las familias con alumnos
// activos y genera uno por familia, sumando el `precio_bruto` de cada
// alumno. Un alumno activo al que nadie le ha puesto tarifa suma 0, así que
// el recibo se genera igual, sale por 0 € y se envía a la familia sin que
// nada falle ni avise. En el ensayo del cierre de septiembre de 2026 había
// exactamente un caso así en producción, y se habría descubierto cuando la
// familia abriera el correo.
//
// AVISA, NO BLOQUEA. Es el mismo criterio que el límite de plazas por
// franja: el centro sabe cosas que la base de datos no. Puede haber un
// alumno recién dado de alta cuyo precio aún se está negociando y a quien
// este mes no se le cobra a propósito. Bloquear el lote entero por eso
// obligaría a inventarse un precio para poder cobrar a los otros 19.
//
// SOLO LOS QUE NO TIENEN TARIFA, no los que tienen una de 0 €. Ver el
// comentario de `tiene_tarifa` en server/lib/academiaRecibos/consultas.js:
// una tarifa de 0 € es una decisión (una beca), la ausencia de tarifa es un
// olvido. Si el aviso saltara con las becas saldría todos los meses para
// siempre, y un aviso que sale siempre se deja de leer justo el mes que
// avisa de algo de verdad.
//
// SE LEE DEL LISTADO QUE YA ESTÁ CARGADO. No hace falta consulta nueva: el
// panel ya trae `alumnos_activos` de cada familia para pintar los cursos y
// el estado (ver listado.routes.js).

const MAX_NOMBRES = 6;

// Alumnos activos de familias que van a recibir recibo y no tienen tarifa.
// Se devuelven con su familia porque el aviso tiene que dejar encontrarlos:
// "Santiago" a secas no basta para saber en qué ficha entrar.
export function alumnosSinPrecio(items = []) {
  const encontrados = [];
  for (const item of items) {
    for (const alumno of item?.alumnos_activos || []) {
      // `tiene_tarifa === undefined` es un backend viejo respondiendo (o un
      // test que no lo simula): en ese caso no se inventa un aviso, porque
      // no hay forma de distinguir el olvido de la beca. Callar es lo
      // correcto — un aviso falso es peor que ninguno.
      if (alumno?.tiene_tarifa !== false) continue;
      encontrados.push({
        id: alumno.id,
        nombre: alumno.nombre,
        curso: alumno.curso,
        familiaId: item.familia_id,
        familiaNombre: item.familia_nombre,
      });
    }
  }
  return encontrados;
}

function conCurso(alumno) {
  return alumno.curso ? `${alumno.nombre} (${alumno.curso})` : alumno.nombre;
}

// El texto del aviso. Dice QUÉ pasa y QUÉ va a pasar si se genera igual —
// "revisa los precios" no informa de nada, y quien lo lee necesita saber si
// puede seguir o no.
export function textoAvisoSinPrecio(sinPrecio = []) {
  if (!sinPrecio.length) return "";

  const visibles = sinPrecio.slice(0, MAX_NOMBRES).map(conCurso);
  const restantes = sinPrecio.length - visibles.length;
  const lista = restantes > 0 ? `${visibles.join(", ")} y ${restantes} más` : visibles.join(", ");

  return sinPrecio.length === 1
    ? `${lista} no tiene precio puesto: su recibo saldría a 0 €.`
    : `${sinPrecio.length} alumnos no tienen precio puesto: ${lista}. Sus recibos saldrían a 0 €.`;
}

// Devuelve el nodo del aviso, o null si no hay nada que avisar — así quien
// lo llama no tiene que repetir la comprobación antes de insertarlo.
export function buildAvisoSinPrecio(items = []) {
  const sinPrecio = alumnosSinPrecio(items);
  if (!sinPrecio.length) return null;

  const aviso = document.createElement("p");
  aviso.className = "ef-aviso-sin-precio";
  // El lector de pantalla lo anuncia al aparecer, pero sin interrumpir lo
  // que se esté leyendo: no es un error, es algo que conviene mirar antes
  // de pulsar Generar.
  aviso.setAttribute("role", "status");
  aviso.appendChild(buildIcon("alertTriangle", { size: 14 }));

  const texto = document.createElement("span");
  texto.textContent = textoAvisoSinPrecio(sinPrecio);
  aviso.appendChild(texto);
  return aviso;
}
