import { spawn } from "node:child_process";
import net from "node:net";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

async function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once("error", () => resolve(false))
      .once("listening", () => server.close(() => resolve(true)))
      .listen(port);
  });
}

async function pickPort(start = 3000, maxTries = 5) {
  for (let i = 0; i < maxTries; i += 1) {
    const port = start + i;
    if (await isPortFree(port)) return port;
  }
  return start;
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function redactToken(token = "") {
  if (!token) return "";
  return token.slice(0, 30) + "...";
}

async function main() {
  const email = requireEnv("SEED_TEACHER_EMAIL");
  const password = requireEnv("SEED_TEACHER_PASSWORD");

  const port = await pickPort(3000, 6);
  const dev = spawn("npx", ["vercel", "dev", "--listen", String(port)], {
    stdio: "ignore",
  });

  try {
    await wait(4000);

    const loginRes = await fetch(`http://localhost:${port}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const loginJson = await loginRes.json();
    const token = loginJson?.data?.access_token || "";

    const meRes = await fetch(`http://localhost:${port}/api/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meJson = await meRes.json();

    const groupsRes = await fetch(`http://localhost:${port}/api/v1/groups?limit=20&offset=0`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-tenant-slug": "lyceo",
      },
    });
    const groupsJson = await groupsRes.json();

    console.log(JSON.stringify({
      port,
      login: {
        status: loginRes.status,
        access_token: redactToken(token),
      },
      me: {
        status: meRes.status,
        body: meJson,
      },
      groups: {
        status: groupsRes.status,
        body: groupsJson,
      },
    }, null, 2));
  } finally {
    try { dev.kill("SIGTERM"); } catch {}
  }
}

main().catch((err) => {
  console.error("smoke failed:", err?.message || err);
  process.exit(1);
});
