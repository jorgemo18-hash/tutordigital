export function initAdminReturn() {
  try {
    if (localStorage.getItem("ttd_admin_return") !== "1") return;
    const returnBtn = document.createElement("button");
    returnBtn.type = "button";
    returnBtn.id = "adminReturnBtn";
    returnBtn.className = "td-sidebar-item";
    returnBtn.innerHTML = `<svg class="td-sidebar-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 5l-7 7 7 7"/></svg><span>Admin</span>`;
    returnBtn.addEventListener("click", () => {
      try { localStorage.removeItem("ttd_admin_return"); } catch {}
      window.location.href = "/assets/admin/";
    });
    const sidebarBottom = document.querySelector(".td-sidebar-bottom");
    if (sidebarBottom) {
      sidebarBottom.insertBefore(returnBtn, sidebarBottom.firstChild);
    } else {
      document.body.appendChild(returnBtn);
    }
  } catch {}
}
