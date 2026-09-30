// ENVÍO A FAMILIAS: QUÉ MES VA EN CADA DOCUMENTO Y QUÉ FALTA (30/09/2026).
//
// La cabecera dice con palabras "Recibo de octubre · informe de septiembre"
// (lo que manda el servidor en `periodo_informe`), y la lista de lo que
// falta abre la familia al pulsar un nombre. Ver envioFamilias/cabecera.js
// y envioFamilias/queFalta.js.
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const alumno = (id, nombre, extra = {}) => ({
  id, nombre, curso: "1º ESO", tiene_tarifa: true, tiene_sesiones: true, informe_redactado: false, informe_enviado_at: null, ...extra,
});
const RECIBOS = [
  { familia_id: "f1", familia_nombre: "Familia Ruiz", familia_email: "r@x.es", recibo: null, alumnos_activos: [alumno("a1", "Eric Ruiz")] },
  { familia_id: "f2", familia_nombre: "Familia Val", familia_email: "v@x.es", recibo: { id: "r2", estado: "borrador", total_neto: 85 }, alumnos_activos: [alumno("a2", "Aarón Val"), alumno("a3", "Nora Val", { informe_redactado: true })] },
];

async function abrir(browser, { width = 1440, height = 900, seccion = "envio_familias", config = {} } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 720, hasTouch: width < 720 });
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date("2026-10-05T10:00:00"));
  await installApiMocks(page, { roles: ["admin"], routes: {
    "**/api/v1/academia/recibos?mes=*": { data: { recibos: RECIBOS, periodo_informe: { mes: 9, anio: 2026 } } },
    "**/api/v1/academia/recibos/meses-enviados*": { data: { meses: [] } },
    "**/api/v1/academia/informes/*": { data: { dias: [], tieneSesionesClase: true, comentario: null, enviadoAt: null } },
    "**/api/v1/academia/config": { data: { config } },
  } });
  await page.goto(`/assets/academia/admin/index.html#${seccion}`, { waitUntil: "networkidle" });
  return { context, page };
}

test.describe("academia admin — envío del mes", () => {
  test("la cabecera dice qué mes va en el recibo y cuál en el informe", async ({ browser }) => {
    const { context, page } = await abrir(browser);
    await expect(page.locator(".ef-que-se-envia")).toHaveText("Recibo de octubre · informe de septiembre");
    await context.close();
  });

  test("lo que falta: al pulsar un nombre se abre su familia", async ({ browser }) => {
    const { context, page } = await abrir(browser);
    const informes = page.locator('.ef-que-falta-categoria[data-clave="informes"]');
    await expect(informes.locator("summary")).toHaveText("2 informes de septiembre sin redactar");
    await informes.locator("summary").click();
    const pedidas = [];
    page.on("request", (r) => { if (r.url().includes("/academia/informes/")) pedidas.push(new URL(r.url()).searchParams.get("mes")); });
    await informes.getByRole("button", { name: "Aarón Val (Familia Val)" }).click();
    await expect(page.locator(".ef-tabs-row")).toBeVisible();
    // Los informes que enseña el panel son los de SEPTIEMBRE, no los de octubre.
    await expect.poll(() => pedidas.length).toBeGreaterThan(0);
    expect(new Set(pedidas)).toEqual(new Set(["9"]));
    if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/envio-escritorio.png` });
    await context.close();
  });

  test("en el móvil no hace scroll horizontal", async ({ browser }) => {
    const { context, page } = await abrir(browser, { width: 390, height: 844 });
    await page.locator('.ef-que-falta-categoria[data-clave="recibos"] summary').click();
    const { scroll, ancho } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, ancho: window.innerWidth }));
    expect(scroll).toBeLessThanOrEqual(ancho);
    if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/envio-movil.png`, fullPage: true });
    await context.close();
  });

  // "TOCA ENVIAR" (30/09/2026): con día del envío configurado, desde ese día
  // hay una franja arriba en cualquier sección, y Revisar lleva al envío.
  test("la franja de 'toca el envío' sale en cualquier sección y Revisar abre Envío a familias", async ({ browser }) => {
    const { context, page } = await abrir(browser, { seccion: "finanzas", config: { dia_envio: 5 } });
    const franja = page.locator(".ac-aviso-envio");
    await expect(franja).toContainText("Toca el envío a familias — recibo de octubre · informe de septiembre · 2 familias pendientes");
    if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/aviso-escritorio.png` });
    await franja.getByRole("button", { name: "Revisar" }).click();
    await expect(page.locator("h1.ac-title")).toHaveText("Envío a familias");
    await context.close();
  });

  test("la franja en el móvil no tapa el menú ni hace scroll horizontal", async ({ browser }) => {
    const { context, page } = await abrir(browser, { width: 390, height: 844, seccion: "alumnos", config: { dia_envio: 5 } });
    await expect(page.locator(".ac-aviso-envio")).toBeVisible();
    const menu = await page.locator(".ac-menu-btn").boundingBox();
    const franja = await page.locator(".ac-aviso-envio").boundingBox();
    expect(franja.x).toBeGreaterThanOrEqual(menu.x + menu.width);
    const { scroll, ancho } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, ancho: window.innerWidth }));
    expect(scroll).toBeLessThanOrEqual(ancho);
    if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/aviso-movil.png` });
    await context.close();
  });

  test("sin día configurado no hay franja", async ({ browser }) => {
    const { context, page } = await abrir(browser, { seccion: "finanzas" });
    await page.waitForTimeout(300);
    await expect(page.locator(".ac-aviso-envio")).toHaveCount(0);
    await context.close();
  });
});
