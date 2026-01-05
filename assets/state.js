// ========= DOM =========
export const DOM = {
  chat: document.getElementById("chat"),
  inp: document.getElementById("inp"),
  btn: document.getElementById("btn"),
  kbd: document.getElementById("kbd"),
  pad: document.getElementById("pad"),
  eqPreview: document.getElementById("eqPreview"),
  micBtn: document.getElementById("mic"),
};

// ========= ESTADO GLOBAL =========
export const STATE = {
  rec: null,
  isRecording: false,
  manualStop: false,
  draftFinal: "",
  insertCtx: null,

  DAY_KEY: "ttd_chat_day",
  HIST_KEY: "ttd_chat_history_v1",
};
