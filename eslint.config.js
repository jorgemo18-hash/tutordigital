// Únicamente automatiza el límite de 400 líneas por archivo que hasta
// ahora solo vivía repetido en cada instrucción — deliberadamente no
// incluye ninguna otra regla de estilo. skipBlankLines/skipComments: el
// límite es sobre líneas de lógica real, nunca sobre documentación (los
// comentarios largos que explican una decisión son deseables).
//
// assets/shared/vendor/** (pdf.js vendorizado) y runtime-config.js
// (generado por scripts/generate-runtime-config.mjs en el build de
// Vercel) quedan fuera: no son código propio que debamos trocear.
//
// tests/** queda fuera a propósito — no está bajo server/** ni assets/**,
// así que ya no hace falta excluirlo explícitamente, pero se documenta
// aquí el motivo: un archivo de test crece con el número de casos que
// cubre una misma funcionalidad, no con responsabilidades mezcladas —
// no es la misma señal de alarma que en código de producción.
export default [
  {
    files: ["server/**/*.js", "assets/**/*.js"],
    ignores: ["assets/shared/vendor/**", "assets/shared/config/runtime-config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "max-lines": ["error", { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Excepción puntual y documentada — no una vía de escape genérica.
    // student.js es el composition root del panel alumno: cablea ~25
    // controladores con dependencias cruzadas (patrón onFinishedRef/addRef
    // para resolver referencias circulares). Ya tuvo un primer split (ver
    // su propio comentario de cabecera, "Nivel 1 de split aplicado"); el
    // siguiente nivel implica REORDENAR esa inicialización, un cambio que
    // el propio archivo señala como pendiente "hasta que exista cobertura
    // de tests de UI para este flujo" — forzarlo ahora solo para cumplir
    // el linter iría en contra de esa decisión ya tomada. Revisar aparte
    // cuando exista esa cobertura, no aquí.
    files: ["assets/student/student.js"],
    rules: {
      "max-lines": "off",
    },
  },
];
