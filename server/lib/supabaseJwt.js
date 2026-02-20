import { createRemoteJWKSet, jwtVerify } from "jose";

let cachedJwks = null;
let cachedIssuer = "";

function getIssuer() {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL env var");
  return `${supabaseUrl}/auth/v1`;
}

function getJwks(issuer) {
  if (cachedJwks && cachedIssuer === issuer) return cachedJwks;
  cachedIssuer = issuer;
  cachedJwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  return cachedJwks;
}

export async function verifySupabaseJwt(token) {
  const issuer = getIssuer();
  const jwks = getJwks(issuer);

  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    // audience: "authenticated",
  });

  return payload;
}
