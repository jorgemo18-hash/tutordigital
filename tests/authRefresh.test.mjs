function fakeClient({ session = null, error = null } = {}) {
  return {
    auth: {
      refreshSession: async () => ({ data: session ? { session } : null, error }),
    },
  };
}

export async function run({ test, assert }) {
  const { refreshUserSession } = await import("../server/lib/authRefresh.js");

  test("refreshUserSession: refresh_token válido -> ok con la sesión nueva", async () => {
    const session = {
      access_token: "nuevo-access",
      refresh_token: "nuevo-refresh",
      expires_at: 1234567890,
      token_type: "bearer",
    };
    const res = await refreshUserSession("refresh-viejo", {
      createClientFn: () => fakeClient({ session }),
    });
    assert.equal(res.ok, true);
    assert.deepEqual(res.session, session);
  });

  test("refreshUserSession: Supabase devuelve error -> ok:false con el motivo", async () => {
    const res = await refreshUserSession("refresh-caducado", {
      createClientFn: () => fakeClient({ error: { message: "Invalid Refresh Token: Already Used" } }),
    });
    assert.equal(res.ok, false);
    assert.equal(res.motivo, "Invalid Refresh Token: Already Used");
  });

  test("refreshUserSession: sin error pero sin session en la respuesta -> ok:false", async () => {
    const res = await refreshUserSession("token-raro", {
      createClientFn: () => fakeClient({}),
    });
    assert.equal(res.ok, false);
    assert.ok(res.motivo);
  });
}
