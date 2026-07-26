// Regresión: el FAB de fichaje (.ac-fichar-fab, montado en document.body,
// esquina inferior derecha) se dibujaba por encima del pie de acciones de
// cualquier drawer abierto en el mismo panel — ambos viven en la misma
// esquina. Un primer intento bajó el z-index del FAB por debajo del
// drawer, pero en producción el botón seguía tapado (ver el comentario en
// fichar-fab.css sobre el @import sin versión de ese archivo — probable
// causa real). Fix definitivo: con un drawer abierto, el FAB se DESPLAZA
// a la izquierda (--ac-drawer-width, ver 00-tokens.css) para quedar sobre
// el contenido principal, nunca superpuesto; en viewport estrecho (el
// drawer pasa a 100vw, no queda hueco) se OCULTA en vez de desplazarse.
// Ambos casos usan el mismo mecanismo CSS puro (body:has(.ac-drawer-overlay.open)),
// sin ninguna señal "drawer abierto" en JS.
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

async function gotoAcademiaAdmin(browser, routas, contextOpts) {
  const context = await browser.newContext(contextOpts);
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await installApiMocks(page, {
    roles: ["admin"],
    routes: {
      "**/api/v1/academia/config": { data: { config: { control_horario_activo: true } } },
      "**/api/v1/academia/fichajes/mi-estado": { data: { dentro: false, haFichadoEntradaHoy: false } },
      ...routas,
    },
  });
  await page.goto("/assets/academia/admin/index.html", { waitUntil: "networkidle" });
  return { context, page };
}

// Un drawer por sección — mismas rutas/selectores que la versión anterior
// de este test, ahora reunidos aquí para reutilizarlos tanto en desktop
// (comprueba el desplazamiento) como en móvil (comprueba el ocultamiento),
// sin duplicar la navegación de cada uno.
const DRAWERS = {
  alumno: {
    routes: {
      "**/api/v1/academia/alumnos*": { data: { alumnos: [{ id: "a1", nombre: "Ana García", curso: "1º ESO", nivel: "eso", familia: null }], total: 1, page: 1, pageSize: 30 } },
      "**/api/v1/academia/alumnos/a1": { data: { alumno: { id: "a1", nombre: "Ana García", curso: "1º ESO", nivel: "eso", activo: true, fecha_alta: "2026-01-10", familia: null, tarifa: null, horario: [] } } },
    },
    async abrir(page) {
      await page.click('.ac-sidebar-item[data-section-id="alumnos"]');
      await page.click(".ac-list .ac-list-row");
      await expect(page.locator(".ac-drawer-overlay.open .ac-drawer-title")).toHaveText("Editar alumno");
    },
    footButtonSelector: '.ac-drawer-overlay.open .ac-drawer-foot button:has-text("Guardar")',
  },
  profesor: {
    routes: {
      "**/api/v1/admin/teachers": { data: { teachers: [{ id: "p1", display_name: "Luis Ruiz", email: "luis@demo.test", is_active: true }] } },
    },
    async abrir(page) {
      await page.click('.ac-sidebar-item[data-section-id="profesores"]');
      await page.click("tr.ac-fila-clicable");
      await expect(page.locator(".ac-drawer-overlay.open")).toBeVisible();
    },
    footButtonSelector: '.ac-drawer-overlay.open .ac-drawer-foot button:has-text("Guardar cambios")',
  },
  gasto: {
    routes: {
      "**/api/v1/academia/finanzas/gastos/**": { data: { gastos: [], resumen: { total: 0, iva_soportado: 0, ticket_medio: 0 }, categorias: [] } },
    },
    async abrir(page) {
      await page.click('.ac-sidebar-item[data-section-id="finanzas"]');
      await page.locator(".ac-list-tabs").first().locator('.ac-list-tab:has-text("Gastos")').click();
      await page.click('button:has-text("Añadir gasto")');
      await expect(page.locator(".ac-drawer-overlay.open .ac-drawer-title")).toContainText("Nuevo gasto");
    },
    footButtonSelector: '.ac-drawer-overlay.open .ac-drawer-foot-right button:has-text("Guardar gasto")',
  },
  sustitucion: {
    routes: {
      "**/api/v1/academia/sustituciones/profesores": { data: { profesores: [{ id: "p1", name: "Luis Ruiz" }, { id: "p2", name: "Marta Soto" }] } },
      "**/api/v1/academia/sustituciones": { data: { sustituciones: [] } },
    },
    async abrir(page) {
      await page.click('.ac-sidebar-item[data-section-id="sustituciones"]');
      await page.click('button:has-text("Nueva sustitución")');
      await expect(page.locator(".ac-drawer-overlay.open")).toBeVisible();
    },
    footButtonSelector: '.ac-drawer-overlay.open .ac-drawer-foot-right button:has-text("Crear sustitución")',
  },
};

// El drawer entra con transform: translateX() animado (.22s, ver
// .ac-drawer) y el FAB se desplaza con su propia transición en `right`
// (misma duración, ver fichar-fab.css) — expect.poll reintenta hasta que
// ambas animaciones se asienten, en vez de medir a mitad de camino.
async function esperarAnimacionesAsentadas(page, footButtonSelector) {
  const boton = page.locator(footButtonSelector).first();
  await expect(boton).toBeVisible();
  await expect.poll(() => boton.evaluate((btn) => btn.getBoundingClientRect().right <= window.innerWidth + 1)).toBe(true);
  await expect.poll(() => page.locator(".ac-fichar-fab").evaluate((el) => getComputedStyle(el).right)).not.toBe("20px");
}

// Verificación fuerte de "sin superponerse": las cajas del FAB y del
// panel visible del drawer (no el overlay/velo de fondo, que cubre toda
// la pantalla) no se cruzan en absoluto — más estricta que solo mirar el
// centro de un botón concreto.
async function expectFabYDrawerSinSolape(page) {
  const solapan = await page.evaluate(() => {
    const fab = document.querySelector(".ac-fichar-fab").getBoundingClientRect();
    const drawer = document.querySelector(".ac-drawer-overlay.open .ac-drawer").getBoundingClientRect();
    return !(fab.right <= drawer.left || fab.left >= drawer.right || fab.bottom <= drawer.top || fab.top >= drawer.bottom);
  });
  expect(solapan).toBe(false);
}

async function expectBotonNoTapadoPorFab(page, footButtonSelector) {
  const boton = page.locator(footButtonSelector).first();
  const tapado = await boton.evaluate((btn) => {
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const el = document.elementFromPoint(cx, cy);
    return !(btn.contains(el) || el.contains(btn));
  });
  expect(tapado).toBe(false);
}

test.describe("panel academia admin — FAB de fichaje se desplaza para no tapar los drawers (desktop)", () => {
  for (const [nombre, drawer] of Object.entries(DRAWERS)) {
    test(`drawer de ${nombre}`, async ({ browser }) => {
      const { context, page } = await gotoAcademiaAdmin(browser, drawer.routes);
      const fab = page.locator(".ac-fichar-fab");
      await expect(fab).toBeVisible();

      await drawer.abrir(page);
      await esperarAnimacionesAsentadas(page, drawer.footButtonSelector);

      await expect(fab).toBeVisible();
      await expectFabYDrawerSinSolape(page);
      await expectBotonNoTapadoPorFab(page, drawer.footButtonSelector);

      await context.close();
    });
  }
});

test.describe("panel academia admin — FAB de fichaje en viewport móvil", () => {
  test("con el drawer ocupando el 100vw no hay hueco para desplazar el FAB -> se oculta", async ({ browser }) => {
    const { context, page } = await gotoAcademiaAdmin(browser, DRAWERS.alumno.routes, {
      viewport: { width: 375, height: 812 },
    });
    const fab = page.locator(".ac-fichar-fab");
    await expect(fab).toBeVisible();

    await DRAWERS.alumno.abrir(page);

    // El drawer, a 375px de ancho de viewport, ocupa min(380px,100vw) =
    // 100vw — confirma la premisa del caso móvil antes de comprobar el FAB.
    const anchoDrawer = await page.locator(".ac-drawer-overlay.open .ac-drawer").evaluate((el) => el.getBoundingClientRect().width);
    expect(anchoDrawer).toBeGreaterThanOrEqual(375);

    await expect.poll(() => fab.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
    const pointerEvents = await fab.evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pointerEvents).toBe("none");

    // Al cerrar el drawer, el FAB vuelve a ser interactivo sin recargar.
    await page.click('.ac-drawer-overlay.open button:has-text("Cancelar")');
    await expect.poll(() => fab.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    await expect.poll(() => fab.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("auto");

    await context.close();
  });
});
