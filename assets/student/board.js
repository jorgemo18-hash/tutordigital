// /assets/app/board.js
export function initBoard({ filePickEl } = {}) {
  const openBtn = document.getElementById("board");
  const overlay = document.getElementById("boardOverlay");
  const canvas = document.getElementById("boardCanvas");
  const undoBtn = document.getElementById("boardUndo");
  const btnClear = document.getElementById("boardClear");
  const btnCancel = document.getElementById("boardCancel");
  const btnSend = document.getElementById("boardSend");

  if (!openBtn || !overlay || !canvas || !btnClear || !btnCancel || !btnSend || !filePickEl) return;

  const ctx = canvas.getContext("2d");
  let drawing = false;
  let last = { x: 0, y: 0 };
  const HISTORY_MAX = 30;
  let history = [];

  function snapshot() {
    try {
      if (!ctx) return;
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      history.push(img);
      if (history.length > HISTORY_MAX) history.shift();
      if (undoBtn) undoBtn.disabled = history.length <= 1;
    } catch {}
  }

  function restore(img) {
    try {
      if (!ctx || !img) return;
      ctx.putImageData(img, 0, 0);
    } catch {}
  }

  function clearCanvas() {
    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } catch {}
  }

  function resetHistory() {
    history = [];
    snapshot();
  }

  function undo() {
    try {
      if (history.length <= 1) return;
      history.pop();
      const prev = history[history.length - 1];
      clearCanvas();
      restore(prev);
      if (undoBtn) undoBtn.disabled = history.length <= 1;
    } catch {}
  }

  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const root = document.documentElement;
    const bg = getComputedStyle(root).getPropertyValue("--ttd-input").trim() || "#0b0f14";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.strokeStyle = "rgba(255,255,255,.92)";
  }

  function open() {
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    setTimeout(() => {
      fitCanvas();
      resetHistory();
    }, 0);
  }

  function close() {
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
  }

  function posFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  }

  function start(e) {
    e.preventDefault();
    drawing = true;
    last = posFromEvent(e);
  }

  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const cur = posFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(cur.x, cur.y);
    ctx.stroke();
    last = cur;
  }

  function end(e) {
    if (!drawing) return;
    e.preventDefault();
    drawing = false;
    snapshot();
  }

  function clear() {
    fitCanvas();
    resetHistory();
  }

  async function send() {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
    if (!blob) return;

    const file = new File([blob], `pizarra_${Date.now()}.png`, { type: "image/png" });

    const dt = new DataTransfer();
    dt.items.add(file);
    filePickEl.files = dt.files;
    filePickEl.dispatchEvent(new Event("change", { bubbles: true }));

    close();
  }

  openBtn.addEventListener("click", open);
  btnCancel.addEventListener("click", close);
  btnClear.addEventListener("click", clear);
  btnSend.addEventListener("click", send);
  if (undoBtn && !undoBtn.dataset.bound) {
    undoBtn.dataset.bound = "1";
    undoBtn.addEventListener("click", () => undo());
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);

  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end, { passive: false });

  window.addEventListener("resize", () => {
    if (overlay.classList.contains("show")) {
      fitCanvas();
      resetHistory();
    }
  });
}
