// assets/app/index.js
// Entry point for the Tutordigital app (inside app.html)
//
// IMPORTANT:
// This project was refactored to a modular structure under:
//   - assets/app/boot
//   - assets/app/bindings
//   - assets/app/controllers
//   - assets/app/ui
//
// The old entrypoint imported ./chat.js and ./ui/*.js files that no longer exist,
// which caused Vercel (case-sensitive FS) to 404 and the whole app to stop.

import "./boot/initial.js";

// Optional iOS viewport fix (kept as dynamic import so missing file never breaks the app)
(async () => {
  try {
    const mod = await import("../ui/iosviewportfix.js");
    if (typeof mod?.setupIOSViewportFix === "function") {
      mod.setupIOSViewportFix();
    }
  } catch (e) {
    console.warn("iosViewportFix no cargado (no bloquea la app):", e);
  }
})();
