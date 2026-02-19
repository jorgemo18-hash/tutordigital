import fs from "node:fs";
import path from "node:path";

function read(relPath) {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf8");
}

export async function run({ test, assert }) {
  test("tenant guard wiring: groups GET protegido", () => {
    const src = read("server/routes/v1/groups.routes.js");
    assert.match(
      src,
      /app\.get\(\s*["']\/["']\s*,\s*\{\s*preHandler:\s*tenantMembershipGuard\.preHandler\s*\}/
    );
  });

  test("tenant guard wiring: notebook summary GET protegido", () => {
    const src = read("server/routes/v1/notebook.routes.js");
    assert.match(
      src,
      /app\.get\(\s*["']\/summary["']\s*,\s*\{\s*preHandler:\s*tenantMembershipGuard\.preHandler\s*\}/
    );
  });
}
