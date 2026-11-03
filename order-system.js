/**
 * BLUSH VAPE – zamówienia
 * - klik w smak = +1 szt (można kilka razy ten sam)
 * - − przy smaku = usuń 1 szt
 * - na dole: suma sztuk + cena + „Wybierz płatność”
 * - imię/IG → gotówka / przelew
 * - przelew → Instagram
 * - gotówka → „Zamówienie zakończone”
 * <script src="order-system.js"></script> przed </body>
 */
const ORDER_IG_URL = "https://www.instagram.com/blushvape_/";
const ORDER_STORAGE_KEY = "blush_orders_v1";

(function () {
  if (document.getElementById("order-pay-ui")) return;

  const style = document.createElement("style");
  style.textContent = `
    .flavor-tag.selectable {
      cursor: pointer; user-select: none; position: relative;
      transition: .15s; display: inline-flex; align-items: center; gap: .35rem;
    }
    .flavor-tag.selectable.has-qty {
      background: rgba(255,107,157,.32);
      border-color: #ff6b9d;
      box-shadow: 0 0 0 1px #ff6b9d;
    }
    .flavor-qty-badge {
      background: #ff6b9d; color: #111; font-size: .7rem; font-weight: 700;
      min-width: 1.15rem; height: 1.15rem; border-radius: 999px;
      display: inline-flex; align-items: center; justify-content: center; padding: 0 .25rem;
    }
    .flavor-qty-minus {
      background: rgba(0,0,0,.35); border: none; color: #fff; border-radius: 50%;
      width: 1.15rem; height: 1.15rem; font-size: .75rem; line-height: 1;
      cursor: pointer; display: none; align-items: center; justify-content: center; padding: 0;
    }
    .flavor-tag.has-qty .flavor-qty-minus { display: inline-flex; }
    .order-bar {
      margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #2a2a3a;
    }
    .order-bar .order-lines {
      font-size: .82rem; color: #c8c8d0; margin-bottom: .55rem; max-height: 120px; overflow-y: auto;
    }
    .order-bar .order-lines div { margin: .2rem 0; }
    .order-bar .order-total {
      font-size: 1.05rem; font-weight: 700; color: #ff6b9d; margin-bottom: .65rem;
    }
    .order-bar button, .order-pay-ui button {
      width: 100%; border: none; border-radius: 10px; padding: .85rem;
      font-weight: 600; font-size: .95rem; cursor: pointer;
      background: #ff6b9d; color: #111; margin-top: .4rem;
    }
    .order-bar button:disabled { opacity: .4; cursor: not-allowed; }
    .order-pay-ui {
      display: none; position: fixed; inset: 0; z-index: 200;
      background: rgba(0,0,0,.82); backdrop-filter: blur(6px);
      align-items: center; justify-content: center; padding: 1rem;
    }
    .order-pay-ui.open { display: flex; }
    .order-pay-box {
      background: #16161f; border: 1px solid #2a2a3a; border-radius: 16px;
      padding: 1.35rem; max-width: 400px; width: 100%; color: #f0f0f5;
    }
    .order-pay-box h3 { margin: 0 0 .6rem; font-size: 1.15rem; }
    .order-pay-box label { display: block; font-size: .8rem; color: #ff8fb3; margin: .75rem 0 .3rem; }
    .order-pay-box input {
      width: 100%; box-sizing: border-box; padding: .65rem .75rem;
      border-radius: 8px; border: 1px solid #2a2a3a; background: #0f0f16; color: #f0f0f5;
    }
    .pay-options { display: flex; gap: .5rem; margin-top: .35rem; }
    .pay-options button {
      flex: 1; background: #1e1e2a; color: #f0f0f5; border: 1px solid #2a2a3a; margin-top: 0;
    }
    .pay-options button.active {
      border-color: #ff6b9d; background: rgba(255,107,157,.22); color: #ff8fb3;
    }
    .order-success { text-align: center; padding: .8rem 0; }
    .order-success p { color: #3dd68c; margin: .45rem 0; line-height: 1.45; }
    .order-err { color: #ff6b6b; font-size: .85rem; margin-top: .5rem; }
  `;
  document.head.appendChild(style);

  /** @type {Record<string, number>} flavor name -> qty */
  let cart = {};
  let unitPrice = 0;
  let productName = "";
  let productPriceLabel = "";
  let selectedPay = "gotowka";

  const payUI = document.createElement("div");
  payUI.id = "order-pay-ui";
  payUI.className = "order-pay-ui";
  payUI.innerHTML = `
    <div class="order-pay-box" id="order-pay-box">
      <h3>Płatność</h3>
      <div id="order-summary" style="font-size:.85rem;color:#a0a0b0;line-height:1.4"></div>
      <div id="order-summary-price" style="font-weight:700;color:#ff6b9d;margin-top:.4rem"></div>
      <label for="order-name">Imię lub Instagram</label>
      <input type="text" id="order-name" placeholder="np. Ania albo @nick" maxlength="80" />
      <label>Sposób płatności</label>
      <div class="pay-options">
        <button type="button" data-pay="gotowka" class="active">Gotówka</button>
        <button type="button" data-pay="przelew">Przelew</button>
      </div>
      <p class="order-err" id="order-err" hidden></p>
      <button type="button" id="order-submit">Złóż zamówienie</button>
      <button type="button" id="order-cancel" style="background:transparent;border:1px solid #2a2a3a;color:#f0f0f5">Anuluj</button>
      <div id="order-done" class="order-success" hidden></div>
    </div>
    <form name="zamowienie" method="POST" data-netlify="true" netlify netlify-honeypot="bot-field" hidden>
      <input type="hidden" name="form-name" value="zamowienie" />
      <input name="bot-field" />
      <input name="produkt" />
      <input name="smaki" />
      <input name="platnosc" />
      <input name="klient" />
      <input name="cena" />
      <input name="sztuk" />
      <input name="czas" />
    </form>
  `;
  document.body.appendChild(payUI);

  payUI.querySelectorAll("[data-pay]").forEach((btn) => {
    btn.addEventListener("click", () => {
      payUI.querySelectorAll("[data-pay]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedPay = btn.getAttribute("data-pay");
    });
  });

  document.getElementById("order-cancel").onclick = closePay;
  function closePay() {
    payUI.classList.remove("open");
    document.getElementById("order-done").hidden = true;
    document.getElementById("order-submit").hidden = false;
    document.getElementById("order-name").parentElement.querySelector("label").style.display = "";
    document.getElementById("order-name").style.display = "";
    payUI.querySelector(".pay-options").style.display = "";
  }

  function parsePrice(text) {
    if (!text) return 0;
    const m = String(text).replace(",", ".").match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : 0;
  }

  function totalQty() {
    return Object.values(cart).reduce((a, b) => a + b, 0);
  }

  function totalPrice() {
    return unitPrice * totalQty();
  }

  function cartLines() {
    return Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([name, q]) => (q > 1 ? `${name} ×${q}` : name));
  }

  function ensureOrderBar() {
    let bar = document.getElementById("order-bar");
    if (bar) return bar;
    const modal = document.querySelector(".modal") || document.querySelector("#modal .modal") || document.getElementById("modal");
    const host = modal && modal.querySelector ? (modal.classList.contains("modal") ? modal : modal.querySelector(".modal") || modal) : null;
    const target = document.querySelector(".modal.active") || document.querySelector(".modal") || document.getElementById("modal");
    if (!target) return null;
    bar = document.createElement("div");
    bar.id = "order-bar";
    bar.className = "order-bar";
    bar.innerHTML = `
      <div class="order-lines" id="order-lines"></div>
      <div class="order-total" id="order-total">Suma: 0 zł</div>
      <button type="button" id="order-go-pay" disabled>Wybierz płatność</button>
    `;
    // append inside visible modal content
    const inner = target.querySelector(".modal") || target;
    inner.appendChild(bar);

    document.getElementById("order-go-pay").onclick = () => {
      if (totalQty() < 1) return;
      const lines = cartLines();
      document.getElementById("order-summary").innerHTML =
        `<b>${escapeHtml(productName)}</b><br>${lines.map(escapeHtml).join("<br>")}`;
      document.getElementById("order-summary-price").textContent =
        `Do zapłaty: ${totalPrice()} zł (${totalQty()} szt. × ${unitPrice} zł)`;
      document.getElementById("order-name").value = "";
      document.getElementById("order-err").hidden = true;
      document.getElementById("order-submit").hidden = false;
      document.getElementById("order-done").hidden = true;
      document.getElementById("order-name").style.display = "";
      payUI.querySelector(".pay-options").style.display = "flex";
      selectedPay = "gotowka";
      payUI.querySelectorAll("[data-pay]").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-pay") === "gotowka");
      });
      payUI.classList.add("open");
    };
    return bar;
  }

  function updateOrderBar() {
    ensureOrderBar();
    const linesEl = document.getElementById("order-lines");
    const totalEl = document.getElementById("order-total");
    const btn = document.getElementById("order-go-pay");
    const lines = cartLines();
    if (linesEl) {
      linesEl.innerHTML = lines.length
        ? lines.map((l) => `<div>• ${escapeHtml(l)}</div>`).join("")
        : `<div style="color:#a0a0b0">Klikaj smaki — można kilka razy ten sam</div>`;
    }
    if (totalEl) {
      totalEl.textContent = lines.length
        ? `Suma: ${totalPrice()} zł · ${totalQty()} szt.`
        : `Suma: 0 zł`;
    }
    if (btn) btn.disabled = totalQty() < 1;
  }

  function setQty(flavor, qty) {
    qty = Math.max(0, qty | 0);
    if (qty === 0) delete cart[flavor];
    else cart[flavor] = qty;
    // update badges on tags
    document.querySelectorAll("#modal-flavors .flavor-tag.selectable").forEach((tag) => {
      const name = tag.getAttribute("data-flavor") || tag.childNodes[0]?.textContent?.trim() || tag.textContent.trim();
      // get clean name from data-flavor
      const fname = tag.getAttribute("data-flavor");
      if (!fname) return;
      const q = cart[fname] || 0;
      tag.classList.toggle("has-qty", q > 0);
      let badge = tag.querySelector(".flavor-qty-badge");
      if (q > 0) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "flavor-qty-badge";
          tag.appendChild(badge);
        }
        badge.textContent = String(q);
      } else if (badge) badge.remove();
    });
    updateOrderBar();
  }

  function enhanceFlavorTags(box) {
    if (!box) return;
    box.querySelectorAll(".flavor-tag").forEach((tag) => {
      if (tag.dataset.orderBound === "1") return;
      tag.dataset.orderBound = "1";
      tag.classList.add("selectable");
      const fname = (tag.getAttribute("data-flavor") || tag.textContent || "").trim();
      tag.setAttribute("data-flavor", fname);

      const minus = document.createElement("button");
      minus.type = "button";
      minus.className = "flavor-qty-minus";
      minus.textContent = "−";
      minus.title = "Usuń 1";
      minus.addEventListener("click", (e) => {
        e.stopPropagation();
        setQty(fname, (cart[fname] || 0) - 1);
      });
      tag.appendChild(minus);

      tag.addEventListener("click", (e) => {
        if (e.target === minus) return;
        e.stopPropagation();
        setQty(fname, (cart[fname] || 0) + 1);
      });
    });
  }

  function resetCartForProduct() {
    cart = {};
    const title = document.getElementById("modal-title");
    const priceEl = document.getElementById("modal-price");
    productName = title ? title.textContent.trim() : "Produkt";
    productPriceLabel = priceEl ? priceEl.textContent.trim() : "";
    unitPrice = parsePrice(productPriceLabel);
    updateOrderBar();
  }

  document.getElementById("order-submit").onclick = async () => {
    const err = document.getElementById("order-err");
    const name = (document.getElementById("order-name").value || "").trim();
    if (!name) {
      err.textContent = "Wpisz imię albo Instagram";
      err.hidden = false;
      return;
    }
    if (totalQty() < 1) {
      err.textContent = "Wybierz smaki";
      err.hidden = false;
      return;
    }
    err.hidden = true;

    const lines = cartLines();
    const order = {
      id: Date.now().toString(36),
      product: productName,
      price: totalPrice() + " zł",
      unitPrice,
      qty: totalQty(),
      flavors: lines,
      pay: selectedPay,
      client: name,
      at: new Date().toISOString(),
    };

    try {
      const all = JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY) || "[]");
      all.unshift(order);
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(all.slice(0, 300)));
    } catch (e) {}

    try {
      const form = document.querySelector('form[name="zamowienie"]');
      form.produkt.value = order.product;
      form.smaki.value = lines.join("; ");
      form.platnosc.value = order.pay;
      form.klient.value = order.client;
      form.cena.value = order.price;
      form.sztuk.value = String(order.qty);
      form.czas.value = order.at;
      const fd = new FormData(form);
      await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(fd).toString(),
      });
    } catch (e) {}

    document.getElementById("order-submit").hidden = true;
    document.getElementById("order-name").style.display = "none";
    payUI.querySelector(".pay-options").style.display = "none";
    const done = document.getElementById("order-done");
    done.hidden = false;

    if (selectedPay === "przelew") {
      done.innerHTML = `<p>Zamówienie przyjęte.</p><p>Przekierowanie na Instagram (przelew)…</p>`;
      setTimeout(() => { window.location.href = ORDER_IG_URL; }, 1000);
    } else {
      done.innerHTML = `
        <p>✅ Zamówienie zakończone</p>
        <p style="color:#ccc;font-size:.9rem">${escapeHtml(order.product)}<br>${escapeHtml(lines.join(", "))}<br><b>${escapeHtml(order.price)}</b> · gotówka</p>
      `;
    }
  };

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  const obs = new MutationObserver(() => {
    const box = document.getElementById("modal-flavors");
    if (box) enhanceFlavorTags(box);
    ensureOrderBar();
  });

  function boot() {
    const box = document.getElementById("modal-flavors");
    if (box) {
      obs.observe(box, { childList: true, subtree: true });
      enhanceFlavorTags(box);
    }
    const modal = document.getElementById("modal");
    if (modal) obs.observe(modal, { attributes: true, attributeFilter: ["class"], subtree: true });
    ensureOrderBar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  const prev = window.openModal;
  if (typeof prev === "function") {
    window.openModal = function () {
      const r = prev.apply(this, arguments);
      resetCartForProduct();
      setTimeout(() => {
        enhanceFlavorTags(document.getElementById("modal-flavors"));
        ensureOrderBar();
        updateOrderBar();
      }, 80);
      setTimeout(() => {
        enhanceFlavorTags(document.getElementById("modal-flavors"));
        updateOrderBar();
      }, 500);
      return r;
    };
  }
})();
