// assets/student/features/agenda/ctxTools.js
// Handles left-column toolbar: Adjuntar, Calculadora (Desmos), Pizarra (inline canvas)

export function initCtxTools({ filePick } = {}) {
  const btnCtxAdjuntar = document.getElementById("btnCtxAdjuntar");
  const btnCtxCalc     = document.getElementById("btnCtxCalc");
  const btnCtxPizarra  = document.getElementById("btnCtxPizarra");
  const ctxContent     = document.getElementById("ctxContent");
  const desmosPane     = document.getElementById("desmosPane");
  const ctxBoardPane   = document.getElementById("ctxBoardPane");
  const ctxBoardCanvas = document.getElementById("ctxBoardCanvas");
  const ctxBoardUndo   = document.getElementById("ctxBoardUndo");
  const ctxBoardClear  = document.getElementById("ctxBoardClear");
  const ctxBoardSend   = document.getElementById("ctxBoardSend");
  const ctxBoardClose  = document.getElementById("ctxBoardClose");

  let desmosCalc  = null;
  let desmosOpen  = false;
  let boardOpen   = false;
  let drawCtx     = null;
  let isDrawing   = false;
  let strokes     = [];
  let curStroke   = [];

  // ── Helpers ──

  function showContent() {
    if (ctxContent)  ctxContent.hidden  = false;
    if (desmosPane)  desmosPane.hidden  = true;
    if (ctxBoardPane) ctxBoardPane.hidden = true;
    btnCtxCalc?.classList.remove("active");
    btnCtxPizarra?.classList.remove("active");
  }

  // ── Adjuntar ──

  if (btnCtxAdjuntar && filePick) {
    btnCtxAdjuntar.addEventListener("click", () => filePick.click());
  }

  // ── Calculadora (Desmos) ──

  btnCtxCalc?.addEventListener("click", () => {
    if (desmosOpen) {
      if (desmosCalc) { desmosCalc.destroy(); desmosCalc = null; }
      desmosOpen = false;
      showContent();
      return;
    }

    // Close board if open
    if (boardOpen) {
      boardOpen = false;
      if (ctxBoardPane) ctxBoardPane.hidden = true;
      btnCtxPizarra?.classList.remove("active");
    }

    if (ctxContent)  ctxContent.hidden  = true;
    if (desmosPane)  desmosPane.hidden  = false;
    desmosOpen = true;
    btnCtxCalc?.classList.add("active");

    requestAnimationFrame(() => {
      if (!desmosCalc && window.Desmos) {
        try {
          desmosCalc = Desmos.ScientificCalculator(desmosPane, {
            keypad: true,
            language: "es",
          });
        } catch (e) {
          console.warn("[ctxTools] Desmos init failed:", e);
        }
      }
    });
  });

  // ── Pizarra (inline canvas) ──

  function initCanvas() {
    if (!ctxBoardCanvas || drawCtx) return;
    const rect = ctxBoardCanvas.getBoundingClientRect();
    ctxBoardCanvas.width  = Math.round(rect.width)  || 400;
    ctxBoardCanvas.height = Math.round(rect.height) || 300;
    drawCtx = ctxBoardCanvas.getContext("2d");
    drawCtx.lineCap  = "round";
    drawCtx.lineJoin = "round";
    drawCtx.lineWidth = 2.5;
    _fillBg();
  }

  function _fillBg() {
    if (!drawCtx) return;
    drawCtx.fillStyle = "#1c1713";
    drawCtx.fillRect(0, 0, ctxBoardCanvas.width, ctxBoardCanvas.height);
  }

  function _redraw() {
    if (!drawCtx) return;
    _fillBg();
    drawCtx.strokeStyle = "#c4834a";
    strokes.forEach((s) => {
      if (s.length < 2) return;
      drawCtx.beginPath();
      drawCtx.moveTo(s[0].x, s[0].y);
      for (let i = 1; i < s.length; i++) drawCtx.lineTo(s[i].x, s[i].y);
      drawCtx.stroke();
    });
  }

  function _pos(e) {
    const rect = ctxBoardCanvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * (ctxBoardCanvas.width  / rect.width),
      y: (src.clientY - rect.top)  * (ctxBoardCanvas.height / rect.height),
    };
  }

  if (ctxBoardCanvas) {
    const startDraw = (e) => {
      if (!drawCtx) initCanvas();
      isDrawing = true;
      const p = _pos(e);
      curStroke = [p];
      drawCtx.strokeStyle = "#c4834a";
      drawCtx.beginPath();
      drawCtx.moveTo(p.x, p.y);
    };
    const moveDraw = (e) => {
      if (!isDrawing) return;
      const p = _pos(e);
      drawCtx.lineTo(p.x, p.y);
      drawCtx.stroke();
      curStroke.push(p);
    };
    const stopDraw = () => {
      if (!isDrawing) return;
      isDrawing = false;
      if (curStroke.length > 1) strokes.push([...curStroke]);
      curStroke = [];
    };

    ctxBoardCanvas.addEventListener("mousedown", startDraw);
    ctxBoardCanvas.addEventListener("mousemove", moveDraw);
    ctxBoardCanvas.addEventListener("mouseup",   stopDraw);
    ctxBoardCanvas.addEventListener("mouseleave", stopDraw);
    ctxBoardCanvas.addEventListener("touchstart", (e) => { e.preventDefault(); startDraw(e); }, { passive: false });
    ctxBoardCanvas.addEventListener("touchmove",  (e) => { e.preventDefault(); moveDraw(e);  }, { passive: false });
    ctxBoardCanvas.addEventListener("touchend",   stopDraw);
  }

  ctxBoardUndo?.addEventListener("click", () => { strokes.pop(); _redraw(); });
  ctxBoardClear?.addEventListener("click", () => { strokes = []; _redraw(); });

  ctxBoardClose?.addEventListener("click", () => {
    boardOpen = false;
    showContent();
  });

  ctxBoardSend?.addEventListener("click", () => {
    if (!ctxBoardCanvas || !filePick) return;
    ctxBoardCanvas.toBlob((blob) => {
      if (!blob) return;
      try {
        const file = new File([blob], "pizarra.png", { type: "image/png" });
        const dt = new DataTransfer();
        dt.items.add(file);
        filePick.files = dt.files;
        filePick.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (e) {
        console.warn("[ctxTools] DataTransfer failed:", e);
      }
      boardOpen = false;
      showContent();
    }, "image/png");
  });

  btnCtxPizarra?.addEventListener("click", () => {
    if (boardOpen) {
      boardOpen = false;
      showContent();
      return;
    }

    // Close Desmos if open
    if (desmosOpen) {
      if (desmosCalc) { desmosCalc.destroy(); desmosCalc = null; }
      desmosOpen = false;
      if (desmosPane) desmosPane.hidden = true;
      btnCtxCalc?.classList.remove("active");
    }

    if (ctxContent)  ctxContent.hidden   = true;
    if (ctxBoardPane) ctxBoardPane.hidden = false;
    boardOpen = true;
    btnCtxPizarra?.classList.add("active");

    // Init canvas once pane is visible so getBoundingClientRect is accurate
    drawCtx = null;
    strokes = [];
    requestAnimationFrame(() => initCanvas());
  });
}
