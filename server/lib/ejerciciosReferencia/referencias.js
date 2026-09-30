import { readFileSync, readdirSync, existsSync } from "node:fs";

// EJERCICIOS DE REFERENCIA: ejercicios reales, con su solución, de hojas y
// libros libres (Marea Verde, profesores que publican sus fichas…), por
// etapa, materia, curso y tema. NO son ejercicios para imprimir tal cual: son
// lo que el generador de hojas y el tutor miran para saber qué nivel, qué
// tipo de ejercicio y qué notación son los de ese curso (decidido con Jorge
// el 30/9/2026). Cuando Jorge suba «los buenos» de un tema, estos se borran.
//
//   datos/{etapa}/{materia}/{curso}/{tema}.json   (forma: esquema.js)
//
// DE DÓNDE SALEN Y QUÉ SE COMPRUEBA:
//   - el SABER es siempre del currículo de Aragón de ESE curso (lo comprueba
//     el test); lo que diga la fuente sobre temas o cursos no se usa;
//   - las SOLUCIONES de Matemáticas las calcula el código
//     (tools/referencias/comprueba.py): lo que no cuadra, no entra.
//
// Se leen del disco la primera vez que se piden y se quedan en memoria.
const DATOS = new URL("./datos/", import.meta.url);
const NOMBRE = /^[a-z0-9-]+$/;
const cache = new Map();

function carpeta({ etapa, materia, curso }) {
  if (![etapa, materia].every((x) => NOMBRE.test(String(x || ""))) || !Number.isInteger(curso)) return null;
  return new URL(`${etapa}/${materia}/${curso}/`, DATOS);
}

function lee(url) {
  const clave = url.href;
  if (!cache.has(clave)) cache.set(clave, JSON.parse(readFileSync(url, "utf8")));
  return cache.get(clave);
}

// Qué etapas, materias y cursos tienen referencias: [{ etapa, materia, curso, temas }].
export function cursosConReferencias() {
  if (!existsSync(DATOS)) return [];
  const dirs = (url) => readdirSync(url, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  return dirs(DATOS).flatMap((etapa) => dirs(new URL(`${etapa}/`, DATOS)).flatMap((materia) =>
    dirs(new URL(`${etapa}/${materia}/`, DATOS)).map((c) => ({
      etapa, materia, curso: Number(c), temas: temasConReferencias({ etapa, materia, curso: Number(c) }).length,
    }))));
}

// Los temas que tienen referencias en ese curso: [{ tema, titulo, saberes, ejercicios }].
export function temasConReferencias(donde) {
  const dir = carpeta(donde);
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const t = lee(new URL(f, dir));
      return { tema: t.tema, titulo: t.titulo, saberes: t.saberes, ejercicios: t.ejercicios.length };
    });
}

export function referenciasDelTema({ tema, ...donde }) {
  const dir = carpeta(donde);
  if (!dir || !NOMBRE.test(String(tema || ""))) return null;
  const url = new URL(`${tema}.json`, dir);
  return existsSync(url) ? lee(url) : null;
}

// Los ejercicios de un saber (p. ej. "D.4") en todos los temas del curso,
// de menos a más difíciles; `max` recorta manteniendo variedad de tipos.
export function referenciasDelSaber({ saber, max = 12, ...donde }) {
  const todos = temasConReferencias(donde)
    .flatMap(({ tema }) => referenciasDelTema({ ...donde, tema }).ejercicios)
    .filter((e) => e.saberes.includes(saber))
    .sort((a, b) => a.dificultad - b.dificultad);
  const porTipo = new Map();
  for (const e of todos) porTipo.set(e.tipo, [...(porTipo.get(e.tipo) || []), e]);
  const elegidos = [];
  // Uno de cada tipo por vuelta, hasta llegar a `max`.
  for (let vuelta = 0; elegidos.length < Math.min(max, todos.length); vuelta += 1) {
    for (const lista of porTipo.values()) if (lista[vuelta] && elegidos.length < max) elegidos.push(lista[vuelta]);
  }
  return elegidos;
}
