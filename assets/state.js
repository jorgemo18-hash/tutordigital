// assets/state.js

export const DOM = {
  chat: document.getElementById("chat"),
  inp: document.getElementById("inp"),
  btn: document.getElementById("btn"),
  kbd: document.getElementById("kbd"),
  pad: document.getElementById("pad"),
  eqPreview: document.getElementById("eqPreview"),
  agenda: document.getElementById("agenda"),
initialRow: document.getElementById("initialRow"),
btnDeberes: document.getElementById("btnDeberes"),
btnExamen: document.getElementById("btnExamen"),
btnTrabajo: document.getElementById("btnTrabajo"),

  micBtn: document.getElementById("mic"),
  // si no existen en tu HTML, que queden en null sin romper nada
  micCancel: document.getElementById("micCancel"),
  micOk: document.getElementById("micOk"),

  btnDeberes: document.getElementById("btnDeberes"),
  btnExamen: document.getElementById("btnExamen"),
  btnTrabajo: document.getElementById("btnTrabajo"),

  agenda: document.getElementById("agenda"),
  initialRow: document.getElementById("initialRow"),
};

export const STATE = {
  // mic
  rec: null,
  isRecording: false,
  manualStop: false,
  draftFinal: "",
  insertCtx: null,
};
