import fs from "node:fs";

const RAIZ = new URL("../../", import.meta.url).pathname;

// LAS FÓRMULAS SE DIBUJAN. KaTeX no estaba cargado en ningún sitio.
//
// EL PROBLEMA. Había TRES caminos de dibujado escritos —las burbujas del tutor
// (`chatRenderer`, `chatStreamingBubble`) y la vista previa mientras el alumno
// escribe (`ui/preview`)—, todos empezando con `if (!window.katex) return;`, y
// hasta una función `rerenderPendingMath()` cuyo único propósito es "KaTeX ha
// llegado tarde, vuelve a pintar las burbujas". Pero KaTeX no se cargaba en
// ningún HTML del proyecto. `assets/student/index.html` traía Sentry y mathjs
// desde CDN; el motor de fórmulas, no.
//
// Resultado: si el tutor escribía `\(\frac{1}{2}\)`, el alumno veía
// `\(\frac{1}{2}\)`. En una plataforma cuyo caso de uso principal son las
// matemáticas, y cuya razón de ser —dicha por Jorge— era que se pudiera
// escribir "x al cuadrado" bien y no `x^2`, "que mucha gente ni lo sabe".
//
// VENDORIZADO Y NO DESDE UN CDN, y la razón es de método: desde el contenedor
// donde se trabaja no se puede comprobar la URL de un CDN, y si estuviera mal
// el fallo es SILENCIOSO —los tres caminos hacen `return` sin quejarse—, o sea
// exactamente el fallo que se está arreglando. Con los archivos servidos desde
// nuestro dominio se ha podido verificar de verdad: fórmula real dibujada en
// Chromium antes de entregar. Ver assets/shared/vendor/katex/LEEME.md.
export async function run({ test, assert }) {
  const { asciiToLatex, isMathOnly, looksMath } = await import(
    "../../assets/student/controllers/math.js"
  );

  const html = fs.readFileSync(`${RAIZ}assets/student/index.html`, "utf8");

  // ── Que el motor llegue ──────────────────────────────────────────────

  test("REGRESIÓN: el HTML del alumno carga el motor, el auto-render y la hoja", () => {
    assert.match(html, /vendor\/katex\/katex\.min\.js/);
    assert.match(html, /vendor\/katex\/contrib\/auto-render\.min\.js/);
    assert.match(html, /vendor\/katex\/katex\.min\.css/);
  });

  test("REGRESIÓN: auto-render va DESPUÉS del motor", () => {
    // Define `window.renderMathInElement` y necesita el motor ya cargado. Al
    // revés, las burbujas del tutor se quedarían sin dibujar y sin error.
    const iMotor = html.indexOf("vendor/katex/katex.min.js");
    const iAuto = html.indexOf("vendor/katex/contrib/auto-render.min.js");
    assert.ok(iMotor > 0 && iAuto > iMotor);
  });

  test("los archivos vendorizados están de verdad en el repositorio", () => {
    // Un `<script>` apuntando a un archivo que no existe es un 404 silencioso:
    // la página carga igual y las fórmulas se quedan en crudo.
    for (const ruta of [
      "assets/shared/vendor/katex/katex.min.js",
      "assets/shared/vendor/katex/katex.min.css",
      "assets/shared/vendor/katex/contrib/auto-render.min.js",
      "assets/shared/vendor/katex/LEEME.md",
    ]) {
      assert.ok(fs.existsSync(`${RAIZ}${ruta}`), `falta ${ruta}`);
    }
    const fuentes = fs.readdirSync(`${RAIZ}assets/shared/vendor/katex/fonts`);
    assert.equal(fuentes.length, 20, "las 20 fuentes woff2 del paquete");
    assert.ok(fuentes.every((f) => f.endsWith(".woff2")), "solo woff2, ver LEEME.md");
  });

  test("los delimitadores de las burbujas son los que entiende auto-render", () => {
    // Si el prompt del tutor usara `$...$` y aquí se esperara `\(...\)`, no se
    // dibujaría nada y tampoco habría error.
    for (const archivo of [
      "assets/student/render/chatRenderer.js",
      "assets/student/render/chatStreamingBubble.js",
    ]) {
      const fuente = fs.readFileSync(`${RAIZ}${archivo}`, "utf8");
      assert.match(fuente, /left: "\\\\\(", right: "\\\\\)", display: false/, archivo);
      assert.match(fuente, /left: "\\\\\[", right: "\\\\\]", display: true/, archivo);
    }
  });

  // ── El traductor de lo que escribe el alumno ─────────────────────────

  test("REGRESIÓN: una fracción sale con UNA barra invertida, no dos", () => {
    // EL FALLO, visto en la primera prueba con KaTeX cargado: el reemplazo
    // llevaba `"$1\\\\frac{...}"`, que en una cadena de JavaScript son DOS
    // barras. KaTeX leía `\\` como un salto de línea de LaTeX y pintaba la
    // palabra "frac12" tal cual — "1/2 + x^3" salía como "frac12 + x³".
    //
    // Llevaba ahí desde siempre y no lo había visto nadie porque sin motor el
    // traductor no se ejercitaba nunca: un fallo tapado por otro.
    const latex = asciiToLatex("1/2 + x^3");
    assert.equal(latex, "\\frac{1}{2} + x^3");
    assert.equal(latex.includes("\\\\"), false, "dos barras son un salto de línea en LaTeX");
  });

  test("una fecha NO se convierte en una fracción", () => {
    // Es lo que protegen los bordes estrechos de esa expresión. Un alumno
    // escribe "14/09/2026" mucho más a menudo que "(1/2)", que se queda sin
    // convertir y es el precio aceptado.
    assert.equal(asciiToLatex("14/09/2026"), "14/09/2026");
  });

  test("raíces y operadores de teclado se traducen", () => {
    assert.equal(asciiToLatex("√(x+1)"), "\\sqrt{x+1}");
    assert.equal(asciiToLatex("sqrt(16)"), "\\sqrt{16}");
    assert.match(asciiToLatex("3 × 4 ÷ 2"), /\\times/);
    assert.match(asciiToLatex("x ≤ π"), /\\le/);
    assert.match(asciiToLatex("x ≤ π"), /\\pi/);
  });

  test("lo que ya es LaTeX se deja en paz", () => {
    // El tutor manda LaTeX de verdad: volver a traducirlo lo rompería.
    const ya = "\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}";
    assert.equal(asciiToLatex(ya), ya);
  });

  // ── Cuándo se considera que algo es una fórmula ───────────────────────

  test("una frase normal no se dibuja como fórmula", () => {
    // `isMathOnly` decide si la burbuja del alumno se dibuja como fórmula. Un
    // falso positivo convertiría una frase en una ecuación ilegible.
    for (const frase of [
      "no entiendo el ejercicio 3",
      "creo que hay que dividir pero no sé por qué",
      "hola",
    ]) {
      assert.equal(isMathOnly(frase), false, `"${frase}" no es una fórmula`);
    }
  });

  test("una fórmula sola sí", () => {
    for (const formula of ["x^2 + 3x = 10", "2 + 2 = 4", "√16 ÷ 2 ≤ π"]) {
      assert.equal(isMathOnly(formula), true, `"${formula}" sí lo es`);
    }
  });

  test("looksMath es igual o más permisivo que isMathOnly, nunca al revés", () => {
    // looksMath decide si SE INTENTA extraer una fórmula de un texto mixto;
    // isMathOnly, si la burbuja entera se dibuja como fórmula. El segundo
    // tiene que ser el estricto, y aquí se comprueba la relación en vez de
    // fiarse de ella: la primera versión de este test daba por hecho que "el
    // resultado es x^2 = 9" pasaba looksMath, y NO pasa — con una palabra
    // larga y pocas señales matemáticas, las dos dicen que no.
    const casos = [
      "x^2 = 9", "2+2", "sqrt(16)", "√16 ÷ 2 ≤ π", "3x",
      "hola", "no entiendo el ejercicio 3", "2 manzanas",
      "el resultado es x^2 = 9",
    ];
    for (const t of casos) {
      if (isMathOnly(t)) {
        assert.equal(looksMath(t), true, `"${t}": isMathOnly no puede ser más permisivo`);
      }
    }
    // Y hay al menos un caso donde de verdad se separan: `sqrt(16)` tiene una
    // palabra larga ("sqrt"), así que no se dibuja como burbuja-fórmula, pero
    // sí se intenta extraer la fórmula de dentro.
    assert.equal(looksMath("sqrt(16)"), true);
    assert.equal(isMathOnly("sqrt(16)"), false);
  });
}
