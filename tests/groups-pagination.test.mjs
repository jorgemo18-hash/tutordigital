import assert from "node:assert/strict";

export async function run({ test }) {
  const { createApp } = await import("../server/app.js");

  async function inject(req) {
    const app = await createApp();
    try {
      return await app.inject(req);
    } finally {
      await app.close();
    }
  }

  function body(res) {
    try {
      return JSON.parse(res.body || "{}");
    } catch {
      return {};
    }
  }

  function itemsOf(payload) {
    const data = payload?.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  }

  function cmpText(a, b) {
    const av = String(a ?? "");
    const bv = String(b ?? "");
    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;
    return av.localeCompare(bv);
  }

  function cmpYear(a, b) {
    const an = Number.isFinite(Number(a)) ? Number(a) : null;
    const bn = Number.isFinite(Number(b)) ? Number(b) : null;
    if (an === null && bn === null) return 0;
    if (an === null) return 1;
    if (bn === null) return -1;
    return an - bn;
  }

  function cmpGroup(a, b) {
    return (
      cmpText(a?.stage, b?.stage)
      || cmpYear(a?.year, b?.year)
      || cmpText(a?.track, b?.track)
      || cmpText(a?.variant, b?.variant)
      || cmpText(a?.name, b?.name)
    );
  }

  function assertPageSorted(items, label) {
    for (let i = 1; i < items.length; i += 1) {
      assert.equal(
        cmpGroup(items[i - 1], items[i]) <= 0,
        true,
        `${label}: unexpected order between indexes ${i - 1} and ${i}`
      );
    }
  }

  test("/groups paginates with limit/offset and keeps stable order (conditional)", async () => {
    const token = process.env.TEST_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    if (!token || !tenantSlug) return;

    const headers = {
      authorization: `Bearer ${token}`,
      "x-ttd-tenant": tenantSlug,
    };

    const [p0, p2, p0Again] = await Promise.all([
      inject({ method: "GET", url: "/api/v1/groups?limit=2&offset=0", headers }),
      inject({ method: "GET", url: "/api/v1/groups?limit=2&offset=2", headers }),
      inject({ method: "GET", url: "/api/v1/groups?limit=2&offset=0", headers }),
    ]);

    assert.equal(p0.statusCode, 200);
    assert.equal(p2.statusCode, 200);
    assert.equal(p0Again.statusCode, 200);

    const b0 = body(p0);
    const b2 = body(p2);
    const b0Again = body(p0Again);

    const items0 = itemsOf(b0);
    const items2 = itemsOf(b2);
    const items0Again = itemsOf(b0Again);

    assert.equal(Array.isArray(items0), true);
    assert.equal(Array.isArray(items2), true);
    assert.equal(Array.isArray(items0Again), true);
    assert.equal(items0.length <= 2, true);
    assert.equal(items2.length <= 2, true);
    assert.equal(items0Again.length <= 2, true);

    assertPageSorted(items0, "page0");
    assertPageSorted(items2, "page2");
    assertPageSorted(items0Again, "page0Again");

    const ids0 = items0.map((g) => g?.id).filter(Boolean);
    const ids2 = items2.map((g) => g?.id).filter(Boolean);
    const ids0Again = items0Again.map((g) => g?.id).filter(Boolean);

    assert.deepEqual(ids0Again, ids0, "same page should be stable across repeated calls");

    if (items0.length === 2 && items2.length === 2) {
      const overlap = ids0.filter((id) => ids2.includes(id));
      assert.equal(overlap.length, 0, "offset appears ignored: overlapping ids across pages");
      assert.notDeepEqual(ids2, ids0, "offset appears ignored: same page content returned");
    }
  });
}
