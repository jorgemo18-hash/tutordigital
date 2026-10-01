#!/usr/bin/env node
// scripts/metodos-para-revisar.mjs — los pasos de cada tipo de ejercicio,
// escritos para que los revise un profesor (no para el código).
//
// Para cada batería: un ejercicio de ejemplo sacado del generador, los hitos
// que verá el alumno, qué comprueba el código en cada uno, los errores que
// se esperan ahí y la pista general.
//
// USO: node scripts/metodos-para-revisar.mjs > metodos.md
import { readFileSync } from "node:fs";
import { temasConMetodo } from "../server/lib/tutor/metodos/catalogo.js";
import { FORMAS } from "../server/lib/tutor/metodos/esquema.js";
import { TEMAS_CON_GENERADOR } from "../server/lib/generadorEjercicios/temasConGenerador.js";
import { crearAzar } from "../server/lib/generadorEjercicios/aleatorio.js";

const sql = (t) => [...new Set(Object.values(t.migraciones).flat())]
  .map((m) => readFileSync(new URL(`../supabase/migrations/${m}`, import.meta.url), "utf8")).join("\n");

function nombreDeError(texto, id) {
  const m = texto.match(new RegExp(`'${id}',[^\\n]*\\n\\s*'([^']+)'`));
  return m ? m[1] : "(sin nombre)";
}

const lineas = ["# Pasos de cada tipo de ejercicio — para revisar", ""];
for (const metodos of temasConMetodo()) {
  const gen = TEMAS_CON_GENERADOR.find((t) => t.id === metodos.tema);
  const texto = sql(gen);
  const error = (n) => `${n}. ${nombreDeError(texto, gen.idDeConcepto(n).replace(/^c1/, "c2"))}`;
  lineas.push(`## ${gen.nombre} (${gen.curso})`, "",
    `Errores que pueden salir en cualquier paso: ${metodos.erroresDeCualquierPaso.map(error).join(" · ")}.`, "");
  for (const bateria of Object.values(gen.baterias).flat()) {
    const m = metodos.porClave[bateria.clave];
    const ej = bateria.generador(crearAzar(`revisar-${bateria.clave}`), { cuantos: bateria.minimo });
    const apartado = ej.apartados[0];
    const muestra = String(apartado?.texto ?? apartado?.latex ?? "").replace(/\s+/g, " ").slice(0, 160);
    lineas.push(`### ${ej.arquetipo}`, "", `Ejemplo: \`${muestra}\``, "");
    m.hitos.forEach((h, i) => {
      lineas.push(`${i + 1}. **${h.alumno}**`,
        `   - Se da por hecho cuando: ${FORMAS[h.termina]}`,
        `   - Errores que se esperan aquí: ${h.errores.length ? h.errores.map(error).join(" · ") : "ninguno propio"}`,
        `   - Pista: «${h.pista}»`);
    });
    lineas.push("");
  }
}
console.log(lineas.join("\n"));
