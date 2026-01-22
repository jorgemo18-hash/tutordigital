// assets/app/index.js
// Entry point for the Tutordigital app (inside app.html)

import { setupChat } from "./chat.js";
import { setupUI } from "./ui/ui.js";
import { setupFileDrop } from "./ui/fileDrop.js";
import { setupEmojiPicker } from "./ui/emojiPicker.js";
import { setupSendButton } from "./ui/sendButton.js";
import { setupComposer } from "./ui/composer.js";
import { setupSettings } from "./ui/settings.js";
import { setupNotifications } from "./notifications.js";
import { setupAutoScroll } from "./autoScroll.js";
import { setupHistory } from "./history.js";
import { setupUser } from "./user.js";
import { setupCommands } from "./commands.js";

// Bootstrap order matters a bit (UI + composer should exist before interactions)
setupUI();
setupComposer();
setupSendButton();
setupFileDrop();
setupEmojiPicker();
setupSettings();
setupNotifications();
setupAutoScroll();
setupHistory();
setupUser();
setupCommands();
setupChat();

// =========================
// iOS: mantener el composer visible incluso con teclado abierto
// (IMPORTANTE: en Vercel/Linux el path es case-sensitive; si el fichero
//  no existe o cambia el nombre, un import estático rompe toda la app)
// =========================
(async () => {
  try {
    const mod = await import("./ui/iosViewportFix.js");
    if (typeof mod?.setupIOSViewportFix === "function") {
      mod.setupIOSViewportFix();
    }
  } catch (e) {
    console.warn("iosViewportFix no cargado (no bloquea la app):", e);
  }
})();