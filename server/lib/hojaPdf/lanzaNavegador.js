import puppeteer from "puppeteer-core";

// El Chromium sin pantalla que imprime la hoja.
//
// En Vercel (función /api/hoja-pdf) no hay Chromium instalado: se usa el
// que trae empaquetado @sparticuz/chromium, hecho para funciones sin
// servidor. En local y en los tests, CHROMIUM_PATH apunta al que haya en la
// máquina. Se importa solo cuando hace falta porque es un paquete pesado.
export async function lanzaNavegador({ ruta = process.env.CHROMIUM_PATH } = {}) {
  if (ruta) {
    return puppeteer.launch({ executablePath: ruta, headless: true, args: ["--no-sandbox"] });
  }
  const { default: chromium } = await import("@sparticuz/chromium");
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}
