<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Tutordigital</title>

  <!-- APP CSS -->
  <link rel="stylesheet" href="/assets/app/app.css" />
</head>
<body>
  <div class="app">
    <header class="top">
      <button class="back" type="button" aria-label="Inicio">← Inicio</button>
      <div class="titleWrap">
        <div class="title">Tutordigital</div>
        <div class="sub">Modo alumno · Demo</div>
      </div>
    </header>

    <main id="chat" class="chat" aria-label="Chat">
      <!-- Agenda (zona superior) -->
      <section id="agenda" class="agenda" aria-label="Agenda">
        <div class="agendaTitle">Agenda de hoy</div>
        <div class="agendaCards">
          <button id="btnDeberes" class="agendaCard" type="button" aria-label="Deberes de mañana">
            <div class="agendaCardTitle">📘 Deberes de mañana</div>
            <div class="agendaCardBody">
              <ul>
                <li>Lengua · Ejercicios 3 y 4</li>
                <li>Tecnología · Ejercicios 1 y 2</li>
                <li>Matemáticas · Problema 5</li>
              </ul>
            </div>
          </button>

          <button id="btnExamen" class="agendaCard" type="button" aria-label="Próximos exámenes">
            <div class="agendaCardTitle">📝 Próximos exámenes</div>
            <div class="agendaCardBody">
              <ul>
                <li>Matemáticas · viernes</li>
              </ul>
            </div>
          </button>

          <button id="btnTrabajo" class="agendaCard" type="button" aria-label="Trabajo">
            <div class="agendaCardTitle">📁 Trabajo</div>
            <div class="agendaCardBody">
              <ul>
                <li>Historia · entrega en 15 días</li>
              </ul>
            </div>
          </button>
        </div>

        <!-- Fila inicial usada por el boot/scroll lock -->
        <div id="initialRow" class="initialRow" aria-hidden="true"></div>
      </section>

      <!-- Lista de mensajes -->
      <div id="messages" class="messages" aria-live="polite"></div>
    </main>

    <!-- Composer -->
    <footer id="footer" class="footer">
      <!-- Preview de ecuación / texto procesado -->
      <div id="eqPreview" class="eqPreview" aria-hidden="true"></div>

      <!-- Preview de adjuntos (fila superior) -->
      <div id="attachRow" class="attachRow" aria-hidden="true"></div>

      <div class="composer">
        <div class="composerLeft">
          <button id="kbd" class="iconBtn" type="button" aria-label="Teclado matemático">Σ</button>
          <button id="attachBtn" class="iconBtn" type="button" aria-label="Adjuntar">+</button>
        </div>

        <textarea id="inp" placeholder="Escribe aquí…" rows="1" aria-label="Escribe aquí"></textarea>

        <div class="composerRight">
          <button id="micBtn" class="iconBtn" type="button" aria-label="Micrófono">🎤</button>
          <button id="btn" class="sendBtn" type="button" aria-label="Enviar">↑</button>
        </div>
      </div>

      <!-- Pad matemático (se muestra/oculta por JS) -->
      <div id="pad" class="pad" aria-hidden="true"></div>
    </footer>
  </div>

  <script type="module" src="/assets/app/index.js"></script>
</body>
</html>
// assets/ui/iosViewportFix.js
// iOS/Safari: mantener el composer visible incluso con teclado abierto.
// Expone CSS vars:
//   --kb   (px del teclado)
//   --padH (altura del pad cuando está abierto)

export function setupIOSViewportFix() {
  const vv = window.visualViewport;
  const padEl = document.getElementById("pad");
  let rafId = 0;

  function computeKeyboardPx() {
    if (!vv) return 0;
    return Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
  }

  function updateVars() {
    const kb = computeKeyboardPx();

    const padShown = !!(padEl && padEl.classList.contains("show"));
    const padH = padShown && padEl ? (padEl.offsetHeight || 0) : 0;

    document.documentElement.style.setProperty("--kb", kb + "px");
    document.documentElement.style.setProperty("--padH", padH + "px");
  }

  function scheduleUpdate() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      updateVars();
    });
  }

  const onViewportChange = () => scheduleUpdate();
  const onWindowResize = () => scheduleUpdate();

  if (vv) {
    vv.addEventListener("resize", onViewportChange);
    vv.addEventListener("scroll", onViewportChange);
  }
  window.addEventListener("resize", onWindowResize);

  window.__ttdUpdateLayout = updateVars;

  updateVars();

  return function cleanupIOSViewportFix() {
    try {
      if (vv) {
        vv.removeEventListener("resize", onViewportChange);
        vv.removeEventListener("scroll", onViewportChange);
      }
      window.removeEventListener("resize", onWindowResize);
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    } catch {}
  };
}
