import fs from "node:fs";
import path from "node:path";

const RAIZ = new URL("../../", import.meta.url).pathname;

// EL DINERO, EN ESPAÑOL.
//
// EL PROBLEMA (14/09/2026). Toda la aplicación pintaba importes con
// `toFixed(2)`: `2388.00 €`. Formato inglés, en un panel de una academia
// española del que salen recibos y modelos fiscales. Y a partir del millar no
// es solo incorrecto, es engañoso: quien lee `2388.00` deprisa puede ver
// "2,388" —dos euros y pico— donde hay dos mil trescientos.
//
// POR QUÉ ESTÁ ESCRITO A MANO Y NO CON `Intl.NumberFormat`: porque Intl falla
// EN SILENCIO. Node compilado con `small-icu` no conoce es-ES, no lanza ningún
// error y se cae a en-US devolviendo `2,388.00`. El backend corre en Render,
// donde no elegimos el Node de la imagen ni podemos leer los logs. Quince
// líneas propias dan el mismo resultado en todas partes y se pueden probar.
export async function run({ test, assert }) {
  const { formatoEuros, formatoPorcentaje, numeroEs } = await import(
    "../../assets/shared/js/formatoDinero.js"
  );

  test("lo que se ve en la pantalla de finanzas", () => {
    assert.equal(formatoEuros(2388), "2.388,00 €");
    assert.equal(formatoEuros(1280), "1.280,00 €");
    assert.equal(formatoEuros(130), "130,00 €");
    assert.equal(formatoEuros(0), "0,00 €");
  });

  test("el separador de miles aparece donde toca, también por encima del millón", () => {
    assert.equal(numeroEs(999), "999,00");
    assert.equal(numeroEs(1000), "1.000,00");
    assert.equal(numeroEs(17866.5), "17.866,50");
    assert.equal(numeroEs(1234567.89), "1.234.567,89");
  });

  test("los céntimos NUNCA se recortan", () => {
    // "1.200,5 €" se lee mal y en una cifra fiscal no se puede leer mal.
    assert.equal(formatoEuros(1200.5), "1.200,50 €");
    assert.equal(formatoEuros(0.1), "0,10 €");
  });

  test("un importe negativo lleva el signo delante", () => {
    // Los descuentos se pintan así: "-15,00 €".
    assert.equal(formatoEuros(-15), "-15,00 €");
    assert.equal(formatoEuros(-1234.56), "-1.234,56 €");
  });

  test("REGRESIÓN: el -0,00 del redondeo no se enseña como negativo", () => {
    // Un céntimo que se redondea a la baja no es una cantidad negativa, y
    // "-0,00 €" en una pantalla de dinero es exactamente el tipo de cifra que
    // hace dudar de toda la pantalla.
    assert.equal(formatoEuros(-0.001), "0,00 €");
    assert.equal(formatoEuros(-0), "0,00 €");
  });

  test("una cifra que no es un número se pinta como 0, no como NaN", () => {
    // Llega de la API: un campo vacío o nulo no puede escribir "NaN €" en
    // una tarjeta de finanzas.
    assert.equal(formatoEuros(null), "0,00 €");
    assert.equal(formatoEuros(undefined), "0,00 €");
    assert.equal(formatoEuros("no soy un número"), "0,00 €");
    assert.equal(formatoEuros(Infinity), "0,00 €");
  });

  test("un importe que llega como texto se formatea igual", () => {
    // `total_neto` viaja como string desde PostgREST (numeric).
    assert.equal(formatoEuros("2388.00"), "2.388,00 €");
    assert.equal(formatoEuros("1280.5"), "1.280,50 €");
  });

  test("los porcentajes hablan el mismo idioma que los importes", () => {
    // Están en la misma pantalla: con coma en el dinero y punto en el
    // porcentaje, el panel parecía tener dos idiomas.
    assert.equal(formatoPorcentaje(15), "15,00%");
    assert.equal(formatoPorcentaje(20), "20,00%");
    assert.equal(formatoPorcentaje(7.5), "7,50%");
  });

  test("un espacio normal antes del €, no un espacio duro", () => {
    // Lo tipográficamente fino sería  , pero este texto acaba en
    // textContent, en innerHTML, en un email y en un PDF: un carácter que se
    // ve igual y no compara igual rompe tests por motivos invisibles y ensucia
    // la cifra al copiarla a una hoja de cálculo.
    assert.equal(formatoEuros(5).includes(" "), false);
    assert.equal(formatoEuros(5), "5,00 €");
  });

  // ── Que no vuelva por la puerta de atrás ─────────────────────────────

  test("REGRESIÓN: ningún sitio pinta dinero con toFixed", () => {
    // Los `toFixed(2)` que quedan son los de `input.value` —un campo numérico
    // de HTML necesita el punto— y no se tocan. Cualquier otro que escriba un
    // "€" al lado es el formato inglés volviendo.
    const sospechosos = [];
    const barrer = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { barrer(p); continue; }
        if (!e.name.endsWith(".js")) continue;
        if (p.endsWith("formatoDinero.js")) continue;
        const fuente = fs.readFileSync(p, "utf8");
        for (const linea of fuente.split("\n")) {
          if (linea.trim().startsWith("//")) continue;
          if (!/toFixed\(2\)/.test(linea)) continue;
          if (/input\.value/.test(linea)) continue;
          sospechosos.push(`${path.relative(RAIZ, p)}: ${linea.trim().slice(0, 90)}`);
        }
      }
    };
    barrer(`${RAIZ}assets`);
    barrer(`${RAIZ}server`);
    assert.deepEqual(
      sospechosos, [],
      `usa formatoEuros/formatoPorcentaje en vez de toFixed:\n${sospechosos.join("\n")}`
    );
  });
}
