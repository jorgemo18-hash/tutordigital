// VALIDA UNA CARPETA DE EJERCICIOS DE REFERENCIA sin mirar las demás:
//
//   node tools/referencias/valida.mjs server/lib/ejerciciosReferencia/datos/eso/matematicas/3
//
// Lo mismo que tests/ejerciciosReferencia.test.mjs (forma, carpeta, saberes
// de Aragón de ESE curso —y de esa opción en 4.º—, fuentes, verificación) y
// además pasa cada comprobación por el verificador de JavaScript, el que usa
// el servidor con lo que escribe la IA. Lo que solo entiende sympy (derivadas,
// integrales, límites, matrices…) se cuenta aparte: no es un error.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { TemaSchema } from "../../server/lib/ejerciciosReferencia/esquema.js";
import { curriculoDeCurso } from "../../server/lib/curriculo/curriculoAragon.js";
import { slugConEtapa } from "../../assets/shared/curriculo/etapas.js";
import { comprueba } from "../../server/lib/verificador/comprobaciones.js";
import { codigosDeSaberes } from "../../server/lib/ejerciciosReferencia/saberesDelArchivo.js";

const archivos = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? archivos(p) : f.endsWith(".json") ? [p] : [];
});
// Carpetas o archivos sueltos, como comprueba.py.
const rutas = process.argv.slice(2).map((a) => resolve(a)).flatMap((a) => (statSync(a).isDirectory() ? archivos(a) : [a]));
const errores = [];
let soloSympy = 0;
let total = 0;
const ids = new Set();
for (const ruta of rutas) {
  const datos = JSON.parse(readFileSync(ruta, "utf8"));
  const r = TemaSchema.safeParse(datos);
  if (!r.success) { errores.push(`${ruta}: forma: ${JSON.stringify(r.error.issues.slice(0, 3))}`); continue; }
  if (!ruta.endsWith(`/${datos.etapa}/${datos.materia}/${datos.curso}/${datos.tema}.json`)) errores.push(`${ruta}: carpeta y datos no coinciden`);
  const c = curriculoDeCurso(slugConEtapa(datos.etapa, datos.materia), datos.curso);
  if (!c) { errores.push(`${ruta}: la materia no está en el currículo`); continue; }
  const codigos = codigosDeSaberes(c, datos.opcion);
  for (const s of datos.saberes) if (!codigos.has(s)) errores.push(`${ruta}: saber ${s} no está en ${datos.curso}.º${datos.opcion || ""}`);
  for (const e of datos.ejercicios) {
    if (ids.has(e.id)) errores.push(`id repetido: ${e.id}`);
    ids.add(e.id);
    for (const s of e.saberes) if (!codigos.has(s)) errores.push(`${e.id}: saber ${s} no está en ${datos.curso}.º${datos.opcion || ""}`);
    if (!datos.fuentes[e.fuente]) errores.push(`${e.id}: fuente ${e.fuente} sin describir`);
    if (e.comprobar && e.verificacion !== "comprobada") errores.push(`${e.id}: no ha pasado comprueba.py`);
    for (const k of e.comprobar || []) {
      total += 1;
      const v = comprueba(k);
      if (v.ok) continue;
      if (/Función desconocida|desconocid/i.test(v.motivo)) soloSympy += 1;
      else errores.push(`${e.id} ${k.apartado || ""}: el verificador de JS dice: ${v.motivo}`);
    }
  }
}
console.log(`${ids.size} ejercicios, ${total} comprobaciones (${soloSympy} solo las entiende sympy), ${errores.length} errores`);
for (const e of errores) console.log("  ✗", e);
process.exit(errores.length ? 1 : 0);
