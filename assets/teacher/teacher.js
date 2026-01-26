// assets/docente/docente.js
const backBtn = document.getElementById("backHome");
if (backBtn) {
  backBtn.addEventListener("click", () => {
    window.location.href = "/index.html";
  });
}
