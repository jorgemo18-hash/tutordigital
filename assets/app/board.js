// /assets/app/board.js
export function initBoard({ filePickEl } = {}) {
  const openBtn = document.getElementById("board");
  const overlay = document.getElementById("boardOverlay");
  const canvas = document.getElementById("boardCanvas");
  const btnClear = document.getElementById("boardClear");
  const btnCancel = document.getElementById("boardCancel");
  const btnSend = document.getElementById("boardSend");

  if (!openBtn || !overlay || !canvas || !btnClear || !btnCancel || !btnSend || !filePickEl) return;

  const ctx = canvas.getContext("2d");
  let drawing = false;
  let last = { x: 0, y: 0 };

  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    ctx.fillStyle = dark ? "#0b0f14" : "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.strokeStyle = dark ? "rgba(255,255,255,.92)" : "rgba(0,0,0,.92)";
  }

  function open() {
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    setTimeout(() => fitCanvas(), 0);
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
  }

  function clear() {
    fitCanvas();
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
    if (overlay.classList.contains("show")) fitCanvas();
  });
}
