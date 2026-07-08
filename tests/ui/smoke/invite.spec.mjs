// Smoke test de /invite.html: el formulario valida en cliente y muestra
// errores, sin necesidad de backend (doAuth() corta antes de llamar a la
// red — ver invite.html:448-464).
import { test, expect } from "@playwright/test";

test.describe("invite — validación de formulario", () => {
  test("campos vacíos muestra 'Falta email o contraseña.'", async ({ page }) => {
    await page.goto("/invite.html", { waitUntil: "networkidle" });

    const errorBox = page.locator("#authMsg");
    await expect(errorBox).toHaveText("");

    await page.click("#btnAuth");

    await expect(errorBox).toHaveClass(/\berr\b/);
    await expect(errorBox).toHaveText("Falta email o contraseña.");
  });

  test("rellenar solo el email no basta — sigue pidiendo contraseña", async ({ page }) => {
    await page.goto("/invite.html", { waitUntil: "networkidle" });

    await page.fill("#email", "alumno@example.com");
    await page.click("#btnAuth");

    await expect(page.locator("#authMsg")).toHaveText("Falta email o contraseña.");
  });
});
