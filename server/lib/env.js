export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

export function getEnv(name, fallback = "") {
  const value = process.env[name];
  return value == null ? fallback : value;
}
