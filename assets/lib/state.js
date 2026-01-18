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

export const STATE = {
  rec: null,
  isRecording: false,
  manualStop: false,
  draftFinal: "",
  insertCtx: null,
  fromDictation: false,
    // Dictado / UX
  fromDictation: false,
  // True cuando el texto actual del input proviene del dictado (aunque ya hayas parado)
  dictationDraft: false,
};

