// assets/student/features/agenda/ctxTools.js
// Handles left-column toolbar: Adjuntar, Calculadora científica, Pizarra (inline canvas)
//
// Two file inputs are intentionally separate:
//   #ctxFilePick  — left column only (adjuntar + pizarra preview)
//   #filePick     — right chat column only (passed in as `filePick`)
// "Enviar al tutor" from pizarra uses filePick (right) so the drawing reaches the chat.

export function initCtxTools({ filePick } = {}) {
  const btnCtxAdjuntar = document.getElementById("btnCtxAdjuntar");
  const btnCtxCalc     = document.getElementById("btnCtxCalc");
  const btnCtxPizarra  = document.getElementById("btnCtxPizarra");
  const ctxContent     = document.getElementById("ctxContent");
  const ctxCalcPane    = document.getElementById("ctxCalcPane");
  const ctxBoardPane   = document.getElementById("ctxBoardPane");
  const ctxBoardCanvas = document.getElementById("ctxBoardCanvas");
  const ctxBoardUndo   = document.getElementById("ctxBoardUndo");
  const ctxBoardClear  = document.getElementById("ctxBoardClear");
  const ctxBoardSend   = document.getElementById("ctxBoardSend");
  const ctxBoardClose  = document.getElementById("ctxBoardClose");

  // Dedicated left-column file input — does NOT share state with right-column #filePick
  const ctxFilePick = document.getElementById("ctxFilePick");

  // Tool state — single source of truth
  let activePane = null; // "calc" | "board" | null
  let drawCtx    = null;
  let isDrawing  = false;
  let strokes    = [];
  let curStroke  = [];

  // ── Pane visibility ──────────────────────────────────────────────────────

  function _showPane(name) {
    if (ctxContent)   ctxContent.hidden   = (name !== null);
    if (ctxCalcPane)  ctxCalcPane.hidden  = (name !== "calc");
    if (ctxBoardPane) ctxBoardPane.hidden = (name !== "board");
    btnCtxCalc?.classList.toggle("active",    name === "calc");
    btnCtxPizarra?.classList.toggle("active", name === "board");
    activePane = name;
  }

  // ── Adjuntar — left-column only, uses ctxFilePick ────────────────────────

  btnCtxAdjuntar?.addEventListener("click", () => {
    if (ctxFilePick) ctxFilePick.click();
  });

  // ── Calculadora científica ────────────────────────────────────────────────

  const calcExprEl   = document.getElementById("calcExpr");
  const calcResultEl = document.getElementById("calcResult");
  let calcExpr = "";
  let calcResultFrozen = false;

  function _calcSafeEval(str) {
    if (!str) return "0";
    try {
      // Strip all safe function tokens — what remains must be only digits/ops/parens
      const stripped = str
        .replace(/sin\(/g, "").replace(/cos\(/g, "").replace(/tan\(/g, "")
        .replace(/log\(/g, "").replace(/ln\(/g,  "").replace(/sqrt\(/g, "")
        .replace(/pi/g,   "").replace(/\*\*/g,   "");
      if (/[^0-9+\-*/().\s]/.test(stripped)) return "Error";

      // Transform to JS-safe equivalents
      const jsExpr = str
        .replace(/sin\(/g,  "Math.sin(")
        .replace(/cos\(/g,  "Math.cos(")
        .replace(/tan\(/g,  "Math.tan(")
        .replace(/log\(/g,  "Math.log10(")
        .replace(/ln\(/g,   "Math.log(")
        .replace(/sqrt\(/g, "Math.sqrt(")
        .replace(/pi/g,     String(Math.PI));

      // eslint-disable-next-line no-new-func
      const r = Function('"use strict"; return (' + jsExpr + ')')();
      if (typeof r !== "number") return "Error";
      if (!isFinite(r)) return isNaN(r) ? "Error" : (r > 0 ? "∞" : "-∞");
      const rounded = parseFloat(r.toPrecision(10));
      return String(rounded);
    } catch {
      return "";
    }
  }

  function _calcUpdate() {
    if (calcExprEl)   calcExprEl.textContent   = calcExpr;
    if (calcResultEl) calcResultEl.textContent = _calcSafeEval(calcExpr) || "0";
  }

  ctxCalcPane?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-calc]");
    if (!btn) return;
    const val = btn.getAttribute("data-calc");

    if (val === "C") {
      calcExpr = "";
      calcResultFrozen = false;
    } else if (val === "back") {
      calcExpr = calcExpr.slice(0, -1);
    } else if (val === "=") {
      const result = _calcSafeEval(calcExpr);
      if (result && result !== "Error") calcExpr = result;
      calcResultFrozen = true;
    } else {
      // After =, pressing a digit/function starts fresh; operators continue
      if (calcResultFrozen && /^[0-9a-z(]/.test(val)) { calcExpr = ""; }
      calcResultFrozen = false;
      calcExpr += val;
    }
    _calcUpdate();
  });

  btnCtxCalc?.addEventListener("click", () => {
    _showPane(activePane === "calc" ? null : "calc");
  });

  // ── Pizarra (inline canvas) ───────────────────────────────────────────────

  function _fillBg() {
    if (!drawCtx || !ctxBoardCanvas) return;
    drawCtx.fillStyle = "#1c1713";
    drawCtx.fillRect(0, 0, ctxBoardCanvas.width, ctxBoardCanvas.height);
  }

  function _redraw() {
    if (!drawCtx || !ctxBoardCanvas) return;
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

  function _initCanvas() {
    if (!ctxBoardCanvas || drawCtx) return;
    const rect = ctxBoardCanvas.getBoundingClientRect();
    ctxBoardCanvas.width  = Math.round(rect.width)  || 400;
    ctxBoardCanvas.height = Math.round(rect.height) || 300;
    drawCtx = ctxBoardCanvas.getContext("2d");
    drawCtx.lineCap   = "round";
    drawCtx.lineJoin  = "round";
    drawCtx.lineWidth = 2.5;
    _fillBg();
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
    const onStart = (e) => {
      if (!drawCtx) _initCanvas();
      isDrawing = true;
      const p = _pos(e);
      curStroke = [p];
      drawCtx.strokeStyle = "#c4834a";
      drawCtx.beginPath();
      drawCtx.moveTo(p.x, p.y);
    };
    const onMove = (e) => {
      if (!isDrawing) return;
      const p = _pos(e);
      drawCtx.lineTo(p.x, p.y);
      drawCtx.stroke();
      curStroke.push(p);
    };
    const onStop = () => {
      if (!isDrawing) return;
      isDrawing = false;
      if (curStroke.length > 1) strokes.push([...curStroke]);
      curStroke = [];
    };

    ctxBoardCanvas.addEventListener("mousedown",  onStart);
    ctxBoardCanvas.addEventListener("mousemove",  onMove);
    ctxBoardCanvas.addEventListener("mouseup",    onStop);
    ctxBoardCanvas.addEventListener("mouseleave", onStop);
    ctxBoardCanvas.addEventListener("touchstart", (e) => { e.preventDefault(); onStart(e); }, { passive: false });
    ctxBoardCanvas.addEventListener("touchmove",  (e) => { e.preventDefault(); onMove(e);  }, { passive: false });
    ctxBoardCanvas.addEventListener("touchend",   onStop);
  }

  ctxBoardUndo?.addEventListener("click",  () => { strokes.pop(); _redraw(); });
  ctxBoardClear?.addEventListener("click", () => { strokes = []; _redraw(); });
  ctxBoardClose?.addEventListener("click", () => _showPane(null));

  // "Enviar al tutor" → injects canvas blob into the RIGHT-column filePick
  // so the drawing goes to the chat (same flow as a normal file attachment)
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
        console.warn("[ctxTools] DataTransfer error:", e);
      }
      _showPane(null);
    }, "image/png");
  });

  btnCtxPizarra?.addEventListener("click", () => {
    if (activePane === "board") { _showPane(null); return; }
    drawCtx = null; strokes = []; curStroke = [];
    _showPane("board");
    requestAnimationFrame(_initCanvas);
  });
}
