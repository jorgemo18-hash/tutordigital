import { Window } from "happy-dom";

// Entorno DOM mínimo (happy-dom, mismo patrón que alumnosList.test.mjs) —
// auth.js/session/*.js usan window.location, localStorage y sessionStorage
// como globals implícitos, tal como se usarían en un navegador real.
const window = new Window({ url: "http://localhost:8934/assets/admin/index.html" });
globalThis.window = window;
globalThis.localStorage = window.localStorage;
globalThis.sessionStorage = window.sessionStorage;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// true si `promise` sigue sin resolver transcurridos `ms` — usado para
// comprobar que apiFetch, tras un 401 confirmado como sesión caducada,
// nunca entrega el control al llamador (ver handleUnauthorized.js).
async function sigueSinResolver(promise, ms = 30) {
  const centinela = Symbol("pendiente");
  const resultado = await Promise.race([promise, esperar(ms).then(() => centinela)]);
  return resultado === centinela;
}

export async function run({ test, assert }) {
  const auth = await import("../assets/shared/js/auth.js");

  test("apiFetch: 401 con sesión -> refresca una vez y reintenta la petición original de forma transparente", async () => {
    localStorage.clear();
    sessionStorage.clear();
    auth.setSessionTokens({ access_token: "access-viejo", refresh_token: "refresh-valido", expires_at: 111 });

    let llamadasRefresh = 0;
    let llamadasObjetivo = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes("/api/v1/auth/refresh")) {
        llamadasRefresh += 1;
        return {
          ok: true,
          json: async () => ({
            data: { access_token: "access-nuevo", refresh_token: "refresh-nuevo", expires_at: 222, token_type: "bearer" },
          }),
        };
      }
      if (u.includes("/api/v1/algo")) {
        llamadasObjetivo += 1;
        const authHeader = opts?.headers?.get ? opts.headers.get("Authorization") : "";
        if (llamadasObjetivo === 1) {
          assert.equal(authHeader, "Bearer access-viejo", "el primer intento usa el token viejo");
          return { ok: false, status: 401, json: async () => ({ error: { message: "Unauthorized" } }) };
        }
        assert.equal(authHeader, "Bearer access-nuevo", "el reintento usa el token ya refrescado");
        return { ok: true, status: 200, json: async () => ({ data: { ok: true } }) };
      }
      throw new Error(`fetch inesperado: ${u}`);
    };

    try {
      const res = await auth.apiFetch("/api/v1/algo");

      assert.equal(res.ok, true, "apiFetch devuelve la respuesta del reintento, no el 401 original");
      assert.equal(llamadasRefresh, 1);
      assert.equal(llamadasObjetivo, 2, "1 intento original + 1 reintento, nunca más");
      assert.equal(auth.getAccessToken(), "access-nuevo", "el token nuevo queda guardado");
      assert.equal(localStorage.getItem("ttd_refresh_token"), "refresh-nuevo");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("apiFetch: refresh fallido + N peticiones 401 concurrentes -> un solo refresh, una sola redirección, ninguna resuelve", async () => {
    localStorage.clear();
    sessionStorage.clear();
    auth.setSessionTokens({ access_token: "access-caducado", refresh_token: "refresh-caducado", expires_at: 111 });

    let llamadasRefresh = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes("/api/v1/auth/refresh")) {
        llamadasRefresh += 1;
        return { ok: false, status: 401, json: async () => ({ error: { message: "invalid_refresh_token" } }) };
      }
      // Cualquier endpoint de negocio: siempre 401 con esta sesión caducada.
      return { ok: false, status: 401, json: async () => ({ error: { message: "Unauthorized" } }) };
    };

    try {
      const N = 5;
      const promesas = [
        auth.apiFetch("/api/v1/admin/groups"),
        auth.apiFetch("/api/v1/admin/teachers"),
        auth.apiFetch("/api/v1/admin/students"),
        auth.apiFetch("/api/v1/algo-mas"),
        auth.apiFetch("/api/v1/otro-mas"),
      ];
      assert.equal(promesas.length, N);

      // Deja que las N cadenas de refresh-y-reintento se asienten.
      await esperar(20);

      assert.equal(llamadasRefresh, 1, "estampida: N peticiones 401 simultáneas comparten un único refresh");
      assert.equal(window.location.pathname, "/login", "redirección única a /login");
      assert.equal(localStorage.getItem("ttd_access_token"), null, "clearSession() se ejecutó");
      assert.equal(localStorage.getItem("ttd_refresh_token"), null);
      assert.equal(
        sessionStorage.getItem("ttd_session_expired_msg"),
        "Tu sesión ha caducado, vuelve a iniciar sesión.",
        "mensaje visible dejado para /login"
      );

      for (const p of promesas) {
        assert.equal(await sigueSinResolver(p), true, "ninguna de las N promesas resuelve tras una sesión confirmada caducada");
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("expireSession: llamadas repetidas -> solo la primera limpia sesión y redirige", async () => {
    // Import con cache-busting: sessionExpired.js guarda su guard
    // `redirecting` en una variable de módulo que ya quedó en `true` tras
    // el test anterior (disparado de verdad vía apiFetch) — una instancia
    // de módulo nueva permite comprobar el guard desde su estado inicial.
    const { expireSession } = await import(`../assets/shared/js/session/sessionExpired.js?t=${Math.random()}`);

    let llamadasClearSession = 0;
    const clearSession = () => { llamadasClearSession += 1; };

    // 3 llamadas "simultáneas" (sin await entre ellas) — simula que varias
    // cadenas de handleUnauthorized llegan a expireSession casi a la vez.
    expireSession({ clearSession });
    expireSession({ clearSession });
    expireSession({ clearSession });

    assert.equal(llamadasClearSession, 1, "el guard evita repetir clearSession()/redirect en llamadas posteriores");
  });
}
