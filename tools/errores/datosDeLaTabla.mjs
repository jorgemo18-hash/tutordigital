import { writeFileSync } from "node:fs";
const R = new URL("../../server/lib/generadorEjercicios", import.meta.url).pathname;
const { BATERIAS_POR_OBJETIVO, TITULO_DE_OBJETIVO } = await import(`${R}/catalogoDeBaterias.js`);
const { crearAzar } = await import(`${R}/aleatorio.js`);
const { respuestasDe } = await import(`${R}/errores/trampasDelApartado.js`);
const { ERRORES_PREDECIBLES } = await import(`${R}/errores/erroresPredecibles.js`);
const filas = [];
for (const [obj, baterias] of Object.entries(BATERIAS_POR_OBJETIVO)) {
  for (const b of baterias) {
    for (const semilla of ["revision-1", "revision-2"]) {
      const ej = b.generador(crearAzar(`${b.clave}-${semilla}`), { cuantos: Math.min(4, b.maximo || 4) });
      const resp = respuestasDe(ej);
      ej.apartados.forEach((a, i) => {
        const t = Object.fromEntries(resp[i].trampas.map((x) => [x.error, x.respuesta]));
        filas.push({ objetivo: Number(obj), tituloObjetivo: TITULO_DE_OBJETIVO[obj], clave: b.clave, arquetipo: ej.arquetipo,
          texto: (a.texto || "").replace(/___/g, "___"), correcta: resp[i].solucion, trampas: t });
      });
    }
  }
}
writeFileSync(process.argv[2], JSON.stringify({ filas, errores: ERRORES_PREDECIBLES }, null, 1));
console.log(filas.length, "filas");
