/**
 * Wklej na stronę – ładuje availability.json i pokazuje smaki
 * dostępne (zielone) / niedostępne (szare).
 *
 * W HTML dodaj:
 *   <script src="availability-ui.js"></script>
 *   i w modalu smaków wywołaj: renderFlavors(productId, containerEl)
 *
 * productId musi zgadzać się z kluczami w availability.json:
 *   fumot | puffy_50 | puffy_70 | vozol | elf_liq | yami
 */

const AVAILABILITY_URL = "./availability.json"; // ścieżka do pliku JSON

let _availabilityCache = null;

async function loadAvailability() {
  if (_availabilityCache) return _availabilityCache;
  const res = await fetch(AVAILABILITY_URL + "?t=" + Date.now());
  if (!res.ok) throw new Error("Nie można pobrać availability.json");
  _availabilityCache = await res.json();
  return _availabilityCache;
}

/**
 * Renderuje listę smaków do elementu DOM.
 * @param {string} productId - np. "puffy_50"
 * @param {HTMLElement} container - element, do którego wstawić listę
 */
async function renderFlavors(productId, container) {
  container.innerHTML = "<p style='opacity:.6'>Ładowanie smaków…</p>";
  try {
    const data = await loadAvailability();
    const product = data.products[productId];
    if (!product) {
      container.innerHTML = "<p>Brak danych dla tego produktu.</p>";
      return;
    }

    const updated = data.updated_at
      ? new Date(data.updated_at).toLocaleString("pl-PL")
      : "—";

    let html = `
      <div style="font-size:12px;opacity:.55;margin-bottom:10px">
        Aktualizacja: ${updated}
      </div>
      <div style="margin-bottom:8px;font-weight:600;color:#4ade80">
        Dostępne (${product.available.length})
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">
    `;

    for (const item of product.available) {
      const name = typeof item === "string" ? item : item.name;
      const shops = item.shops ? item.shops.join(", ") : "";
      html += `
        <span title="${shops}"
          style="background:#14532d;color:#bbf7d0;border:1px solid #22c55e;
                 padding:4px 10px;border-radius:999px;font-size:13px">
          ${name}
        </span>`;
    }

    html += `</div>`;

    if (product.unavailable && product.unavailable.length) {
      html += `
        <div style="margin-bottom:8px;font-weight:600;color:#f87171">
          Niedostępne (${product.unavailable.length})
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
      `;
      for (const item of product.unavailable) {
        const name = typeof item === "string" ? item : item.name;
        html += `
          <span style="background:#1c1917;color:#a8a29e;border:1px solid #444;
                       padding:4px 10px;border-radius:999px;font-size:13px;
                       text-decoration:line-through;opacity:.7">
            ${name}
          </span>`;
      }
      html += `</div>`;
    }

    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<p style="color:#f87171">Błąd: ${e.message}</p>`;
  }
}

// Eksport globalny
window.renderFlavors = renderFlavors;
window.loadAvailability = loadAvailability;
