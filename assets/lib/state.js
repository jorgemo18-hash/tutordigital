export const DOM = {
  chat: document.getElementById("chat"),
  messages: document.getElementById("messages"),
  inp: document.getElementById("inp"),
  btn: document.getElementById("btn"),
  kbd: document.getElementById("kbd"),
  pad: document.getElementById("pad"),
  eqPreview: document.getElementById("eqPreview"),
  micBtn: document.getElementById("mic"),
  agenda: document.getElementById("agenda"),
  initialRow: document.getElementById("initialRow"),
  btnDeberes: document.getElementById("btnDeberes"),
  btnExamen: document.getElementById("btnExamen"),
  btnTrabajo: document.getElementById("btnTrabajo"),
};

// Version visible (para Vercel y QA)
export const APP_VERSION = "1.3.4";

export const STATE = {
  rec: null,
  isRecording: false,
  manualStop: false,
  draftFinal: "",
  insertCtx: null,
  // Dictado / UX
  fromDictation: false,
};

