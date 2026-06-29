// Compartido por renderInicio.js y renderCentros.js — busca el tenant
// correspondiente a la fila clicada en `allTenants` (explícito, no un
// cierre sobre el scope padre) y llama a onRowClick con él.
export function wireRowClicks(container, allTenants, onRowClick) {
  container.querySelectorAll(".sa-trow[data-slug]").forEach(row =>
    row.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      const t = allTenants.find(x => x.slug === row.dataset.slug);
      if (t) onRowClick(t);
    })
  );
}
