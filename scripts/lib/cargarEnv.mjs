import { readFileSync } from "node:fs";

// Lee el .env de la raíz del repo y lo mete en process.env, sin pisar lo que
// ya venga del entorno.
//
// A mano y no con dotenv: el proyecto no lo tiene como dependencia y estos
// scripts se ejecutan sueltos, fuera del servidor. Son diez líneas y evitan
// una dependencia más en la raíz del package.json.
export function cargarEnv(rutaEnv) {
  try {
    for (const linea of readFileSync(rutaEnv, "utf8").split("\n")) {
      const limpia = linea.trim();
      if (!limpia || limpia.startsWith("#")) continue;
      const igual = limpia.indexOf("=");
      if (igual === -1) continue;
      const clave = limpia.slice(0, igual).trim();
      // Lo que ya está en el entorno manda: permite lanzar un script con una
      // variable puesta delante sin tener que editar el .env.
      if (process.env[clave]) continue;
      process.env[clave] = limpia.slice(igual + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Sin .env no pasa nada: puede venir todo del entorno.
  }
}

// Las dos credenciales que necesitan los scripts que hablan con Storage.
// Devuelve un mensaje de error en vez de lanzar, para que cada script decida
// cómo se queja (uno va a una pantalla, otro a un log de launchd).
export function credencialesSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { ok: false, motivo: "Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY (en el entorno o en .env)." };
  }
  return { ok: true, url, key };
}
