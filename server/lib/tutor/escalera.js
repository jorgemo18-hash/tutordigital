// LA ESCALERA DE AYUDA (decidida con Jorge el 2/10/2026, tutor-arquitectura.md
// 8e y 8f): cada fallo en el MISMO paso del MISMO apartado sube un peldaño, y
// cada peldaño cambia el tipo de ayuda, no la redacción.
//   1. qué ha hecho bien y qué paso revisar (sin decir el error);
//   2. pista concreta del error del catálogo, sin dar la operación;
//   3. un ejemplo parecido, resuelto A LA VEZ: un paso del ejemplo con su
//      porqué, y él hace ese paso en su ejercicio;
//   4. «lo dejamos aquí, se lo decimos a tu profe» (y se le avisa).
export const PELDANOS = 4;

export function peldano(fallosPrevios) {
  return Math.min(PELDANOS, Math.max(0, fallosPrevios) + 1);
}

const lista = (hitos, metodo) => hitos.map((h) => {
  const titulo = metodo.hitos.find((m) => m.id === h.id)?.alumno || h.id;
  const marca = { hecho: "✓", mal: "✗", pendiente: "·", sin_decidir: "?" }[h.estado];
  return `${marca} ${titulo}`;
}).join("\n");

// Lo que se le dice al tutor (la IA) en la parte variable del prompt. El
// veredicto es del CÓDIGO: la IA no lo discute, lo explica.
export function instruccionesParaElTutor(v) {
  const cab = "VEREDICTO DEL COMPROBADOR (lo ha calculado el código y es fiable: no lo contradigas, no des por buena una línea que el código marca mal):";
  if (v.estado === "apartado_desconocido") {
    return `${cab}\nHa escrito cuentas pero no sé de qué apartado son. Pregúntale qué apartado está haciendo. No corrijas nada todavía.`;
  }
  const lineas = v.comprobacion.lineas.map((l, i) => {
    const marca = !l.leida ? "?" : l.equivalente === false ? "✗" : l.equivalente === null ? "?" : "✓";
    return `  ${i + 1}. «${l.texto}» ${marca}`;
  }).join("\n");
  const base = `${cab}\nApartado ${"abcdefgh"[v.apartado]}): ${v.enunciado}\nSus líneas:\n${lineas}\nPasos:\n${lista(v.hitos, v.metodo)}`;

  if (v.dudosas.length) {
    const n = v.dudosas[0];
    return `${base}\n\nNo se ha podido leer la línea ${n + 1} («${v.comprobacion.lineas[n].texto}»). Pregúntale qué ha querido escribir ahí. No corrijas nada hasta saberlo.`;
  }
  if (v.todoHecho) {
    return `${base}\n\nEstá bien y comprobado. Felicítale en una frase concreta (qué ha hecho bien), sin pregunta nueva sobre este apartado. No le expliques nada que ya sabe.`;
  }
  if (v.comprobacion.primeraMal == null) {
    return `${base}\n\nLo que lleva está bien, pero aún no ha terminado. Anímale a seguir con el paso siguiente, con una pregunta general, sin decirle la operación.`;
  }
  const linea = v.comprobacion.primeraMal + 1;
  if (v.nivel === 1) {
    return `${base}\n\nPELDAÑO 1 de 4. La primera línea mal es la ${linea}. Dile qué ha hecho bien (los pasos con ✓) y que revise ese paso. NO le digas cuál es el error ni la operación correcta. Una sola pregunta, general.`;
  }
  if (v.nivel === 2) {
    const e = v.error ? `El error probable es: «${v.error.nombre}» (${v.error.descripcion}).` : "No se ha identificado el error exacto: mira tú la línea y piensa qué ha podido pasar.";
    return `${base}\n\nPELDAÑO 2 de 4: segundo fallo en este paso. ${e} Dale una pista concreta sobre ESE error, en forma de pregunta, sin dar la operación ni el resultado.`;
  }
  if (v.nivel === 3) {
    const ej = v.ejemplo ? `Ejemplo parecido (otros números, ya comprobado): ${v.ejemplo.texto.replace(/___/, String(v.ejemplo.solucion))}\nResolución: ${v.ejemplo.razon}` : "Inventa un ejemplo parecido con otros números (y compruébalo).";
    return `${base}\n\nPELDAÑO 3 de 4: tercer fallo en este paso. Toca ENSEÑAR, no preguntar. ${ej}\nExplícale SOLO el paso que le falla en el ejemplo, con su porqué, y pídele que haga ese mismo paso en su ejercicio y te lo mande. No le resuelvas su ejercicio.`;
  }
  return `${base}\n\nPELDAÑO 4 de 4. Dile con cariño que lo dejáis aquí, que no pasa nada y que se lo decís a su profe para que se lo explique; anímale a seguir con otro ejercicio. No insistas más en este.`;
}
