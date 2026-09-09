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
import globals from "globals";

export default [
  {
    files: ["server/**/*.js", "assets/**/*.js"],
    ignores: ["assets/shared/vendor/**", "assets/shared/config/runtime-config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      // Node para el backend y navegador para el frontend, los dos a la vez:
      // afinar por carpeta obligaría a mantener dos listas y el beneficio es
      // nulo — nadie va a usar `document` en el servidor por descuido, y si
      // lo hace revienta en el primer arranque.
      globals: {
        ...globals.node,
        ...globals.browser,
        // KaTeX se carga por <script> desde el HTML del alumno (no es un
        // módulo que se importe), así que sus dos globales hay que
        // declararlos o `no-undef` los marca. Son los ÚNICOS de terceros:
        // si aparece un tercero más, que se añada aquí conscientemente en
        // vez de relajar la regla.
        katex: "readonly",
        renderMathInElement: "readonly",
      },
    },
    rules: {
      "max-lines": ["error", { max: 400, skipBlankLines: true, skipComments: true }],

      // AÑADIDA EL 09/09/2026 DESPUÉS DE ROMPER UNA RUTA EN PRODUCCIÓN.
      // Al separar /summary a su propio archivo, el handler se movió y tres
      // funciones que usa se quedaron en el archivo viejo. El archivo nuevo
      // las llamaba sin tenerlas: `GET /api/v1/notebook/summary` lanzaba un
      // ReferenceError y devolvía 500, y estuvo así en producción.
      //
      // No lo cazó NADA: `node --check` solo valida sintaxis, los tests no
      // ejercitan esa ruta y el smoke de UI mockea la API. Un identificador
      // inexistente no es un error de parseo — solo revienta cuando esa
      // línea se ejecuta, que puede ser semanas después.
      //
      // Es la regla más barata que existe contra el fallo más caro de
      // encontrar, y el precio es tener que declarar los globals de arriba.
      "no-undef": "error",
    },
  },
  {
    // Ya hubo 44 copias locales de escHtml/_esc/escapeHtml repartidas por
    // el proyecto (consolidadas en 76d1295, y de nuevo 2 más en server/lib
    // que ese commit no tocó por estar fuera de assets/) — divergían entre
    // sí en qué caracteres escapaban, alguna más laxa que el canónico. Esta
    // regla bloquea declarar una función/const local con esos nombres para
    // que la única vía posible sea importar assets/shared/js/escHtml.js.
    // No detecta una reimplementación anónima sin nombre (p.ej. una cadena
    // de .replaceAll() suelta) — eso queda para revisión de código, cubrir
    // ese caso con un selector AST genérico daría muchos falsos positivos.
    files: ["server/**/*.js", "assets/**/*.js"],
    ignores: ["assets/shared/js/escHtml.js"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "FunctionDeclaration[id.name=/^(escHtml|_esc|escapeHtml|escapeHTML)$/]",
          message:
            "No declares una función local de escapado HTML — importa escHtml desde assets/shared/js/escHtml.js.",
        },
        {
          selector:
            "VariableDeclarator[id.name=/^(escHtml|_esc|escapeHtml|escapeHTML)$/] > :matches(ArrowFunctionExpression, FunctionExpression)",
          message:
            "No declares una función local de escapado HTML — importa escHtml desde assets/shared/js/escHtml.js.",
        },
      ],
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
