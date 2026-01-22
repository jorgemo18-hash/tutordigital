#inp,
footer #inp {
  min-height: 42px;
  padding: 10px 12px;
  line-height: 1.35;
  overflow: hidden;
  resize: none;
}

footer:has(#attachRow[aria-hidden="false"]) #inp {
  min-height: 64px;
}

/* Other existing CSS rules remain unchanged, except any other #inp min-height outside attach preview is lowered to 42px */
