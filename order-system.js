const ORDER_IG_URL = "https://www.instagram.com/blushvape_/";
const SUPABASE_URL = "https://zlrmfyulhuyvsjotldju.supabase.co";
const SUPABASE_KEY = "sb_publishable_2neAkxZzfd0VMvcr0omR_w_GbVN4aYq";
const CART_STORAGE_KEY = "blush_cart_v1";

(function () {
  if (document.getElementById("order-pay-ui")) return;

  const style = document.createElement("style");
  style.textContent = `
    .flavor-tag.selectable{cursor:pointer;user-select:none;position:relative;transition:.15s;display:inline-flex;align-items:center;gap:.35rem}
    .flavor-tag.selectable.has-qty{background:rgba(255,107,157,.32);border-color:#ff6b9d;box-shadow:0 0 0 1px #ff6b9d}
    .flavor-qty-badge{background:#ff6b9d;color:#111;font-size:.7rem;font-weight:700;min-width:1.15rem;height:1.15rem;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;padding:0 .25rem}
    .flavor-qty-minus{background:rgba(0,0,0,.35);border:none;color:#fff;border-radius:50%;width:1.15rem;height:1.15rem;font-size:.75rem;line-height:1;cursor:pointer;display:none;align-items:center;justify-content:center;padding:0}
    .flavor-tag.has-qty .flavor-qty-minus{display:inline-flex}
    .order-bar{margin-top:1rem;padding-top:1rem;border-top:1px solid #2a2a3a}
    .order-bar .order-lines{font-size:.82rem;color:#c8c8d0;margin-bottom:.55rem;max-height:140px;overflow-y:auto}
    .order-bar .order-total{font-size:1.05rem;font-weight:700;color:#ff6b9d;margin-bottom:.65rem}
    .order-bar button,.order-pay-ui button{width:100%;border:none;border-radius:10px;padding:.85rem;font-weight:600;font-size:.95rem;cursor:pointer;background:#ff6b9d;color:#111;margin-top:.4rem}
    .order-bar button:disabled{opacity:.4;cursor:not-allowed}
    .order-pay-ui{display:none;position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.82);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:1rem}
    .order-pay-ui.open{display:flex}
    .order-pay-box{background:#16161f;border:1px solid #2a2a3a;border-radius:16px;padding:1.35rem;max-width:420px;width:100%;color:#f0f0f5}
    .order-pay-box h3{margin:0 0 .6rem;font-size:1.15rem}
    .order-pay-box label{display:block;font-size:.8rem;color:#ff8fb3;margin:.75rem 0 .3rem}
    .order-pay-box input{width:100%;box-sizing:border-box;padding:.65rem .75rem;border-radius:8px;border:1px solid #2a2a3a;background:#0f0f16;color:#f0f0f5}
    .pay-options{display:flex;gap:.5rem;margin-top:.35rem}
    .pay-options button{flex:1;background:#1e1e2a;color:#f0f0f5;border:1px solid #2a2a3a;margin-top:0}
    .pay-options button.active{border-color:#ff6b9d;background:rgba(255,107,157,.22);color:#ff8fb3}
    .order-success{text-align:center;padding:.8rem 0}
    .order-success p{color:#3dd68c;margin:.45rem 0;line-height:1.45}
    .order-err{color:#ff6b6b;font-size:.85rem;margin-top:.5rem}
    .ig-btn{background:#ff6b9d!important;color:#111!important;text-decoration:none;display:inline-block;margin-top:.6rem;padding:.7rem 1rem;border-radius:10px;font-weight:600}
  `;
  document.head.appendChild(style);

  let cart = [];
  let selectedPay = "gotowka";
  try { const s = localStorage.getItem(CART_STORAGE_KEY); if (s) cart = JSON.parse(s); } catch(e){}
  const saveCart = () => { try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch(e){} };

  const payUI = document.createElement("div");
  payUI.id = "order-pay-ui";
  payUI.className = "order-pay-ui";
  payUI.innerHTML = `
    <div class="order-pay-box">
      <h3>Płatność</h3>
      <div id="order-summary" style="font-size:.85rem;color:#a0a0b0;line-height:1.4"></div>
      <div id="order-summary-price" style="font-weight:700;color:#ff6b9d;margin-top:.4rem"></div>
      <label for="order-name">Imię lub Instagram</label>
      <input type="text" id="order-name" placeholder="np. Ania albo @nick" maxlength="80">
      <label>Sposób płatności</label>
      <div class="pay-options">
        <button type="button" data-pay="gotowka" class="active">Gotówka</button>
        <button type="button" data-pay="przelew">Przelew</button>
      </div>
      <p class="order-err" id="order-err" hidden></p>
      <button type="button" id="order-submit">Złóż zamówienie</button>
      <button type="button" id="order-cancel" style="background:transparent;border:1px solid #2a2a3a;color:#f0f0f5">Anuluj</button>
      <div id="order-done" class="order-success" hidden></div>
    </div>`;
  document.body.appendChild(payUI);

  payUI.querySelectorAll("[data-pay]").forEach(btn => {
    btn.onclick = () => {
      payUI.querySelectorAll("[data-pay]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedPay = btn.dataset.pay;
    };
  });
  document.getElementById("order-cancel").onclick = () => {
    payUI.classList.remove("open");
    document.getElementById("order-done").hidden = true;
    document.getElementById("order-submit").hidden = false;
    document.getElementById("order-name").style.display = "";
    payUI.querySelector(".pay-options").style.display = "";
  };

  const totalQty = () => cart.reduce((s,i)=>s+i.qty,0);
  const totalPrice = () => cart.reduce((s,i)=>s+i.qty*i.unitPrice,0);

  function getFirma(productName) {
    const n = (productName || "").toLowerCase();
    if (n.includes("puffy")) return "Puffy";
    if (n.includes("vozol") || n.includes("prime")) return "Vozol";
    if (n.includes("yami")) return "Yami";
    if (n.includes("elf")) return "Elf Liq";
    if (n.includes("fumot")) return "Fumot";
    if (n.includes("oxva")) return "OXVA";
    return productName || "Inne";
  }

  function cartLines() {
    return cart.filter(i => i.qty > 0).map(i => {
      const firma = getFirma(i.product);
      return `${firma}: ${i.flavor}${i.qty > 1 ? " ×" + i.qty : ""}`;
    });
  }

  function ensureOrderBar() {
    let bar = document.getElementById("order-bar");
    if (bar) return bar;
    const target = document.querySelector(".modal.active") || document.querySelector(".modal") || document.getElementById("modal");
    if (!target) return null;
    bar = document.createElement("div");
    bar.id = "order-bar";
    bar.className = "order-bar";
    bar.innerHTML = `<div class="order-lines" id="order-lines"></div><div class="order-total" id="order-total">Suma: 0 zł</div><button type="button" id="order-go-pay" disabled>Wybierz płatność</button>`;
    (target.querySelector(".modal")||target).appendChild(bar);
    document.getElementById("order-go-pay").onclick = () => {
      if (totalQty()<1) return;
      document.getElementById("order-summary").innerHTML = cartLines().map(l=>`• ${escapeHtml(l)}`).join("<br>");
      document.getElementById("order-summary-price").textContent = `Do zapłaty: ${totalPrice()} zł (${totalQty()} szt.)`;
      document.getElementById("order-name").value = "";
      document.getElementById("order-err").hidden = true;
      document.getElementById("order-submit").hidden = false;
      document.getElementById("order-done").hidden = true;
      document.getElementById("order-name").style.display = "";
      payUI.querySelector(".pay-options").style.display = "flex";
      selectedPay = "gotowka";
      payUI.querySelectorAll("[data-pay]").forEach(b=>b.classList.toggle("active", b.dataset.pay==="gotowka"));
      payUI.classList.add("open");
    };
    return bar;
  }

  function updateOrderBar() {
    ensureOrderBar();
    const lines = cartLines();
    const linesEl = document.getElementById("order-lines");
    const totalEl = document.getElementById("order-total");
    const btn = document.getElementById("order-go-pay");
    if (linesEl) linesEl.innerHTML = lines.length ? lines.map(l=>`<div>• ${escapeHtml(l)}</div>`).join("") : `<div style="color:#a0a0b0">Klikaj smaki z różnych produktów — wszystko w jednym koszyku</div>`;
    if (totalEl) totalEl.textContent = lines.length ? `Suma: ${totalPrice()} zł · ${totalQty()} szt.` : "Suma: 0 zł";
    if (btn) btn.disabled = totalQty() < 1;
  }

  function setQty(product, flavor, unitPrice, qty) {
    qty = Math.max(0, qty|0);
    const idx = cart.findIndex(i => i.product===product && i.flavor===flavor);
    if (qty===0) { if (idx>=0) cart.splice(idx,1); }
    else if (idx>=0) cart[idx].qty = qty;
    else cart.push({product, flavor, qty, unitPrice});
    saveCart(); refreshBadges(); updateOrderBar();
  }

  function refreshBadges() {
    document.querySelectorAll("#modal-flavors .flavor-tag.selectable").forEach(tag => {
      const fname = tag.getAttribute("data-flavor");
      if (!fname) return;
      const productName = document.getElementById("modal-title")?.textContent?.trim() || "";
      const item = cart.find(i => i.product===productName && i.flavor===fname);
      const q = item ? item.qty : 0;
      tag.classList.toggle("has-qty", q>0);
      let badge = tag.querySelector(".flavor-qty-badge");
      if (q>0) {
        if (!badge) { badge = document.createElement("span"); badge.className="flavor-qty-badge"; tag.appendChild(badge); }
        badge.textContent = q;
      } else if (badge) badge.remove();
    });
  }

  function enhanceFlavorTags(box) {
    if (!box) return;
    const productName = document.getElementById("modal-title")?.textContent?.trim() || "Produkt";
    const unitPrice = parsePrice(document.getElementById("modal-price")?.textContent || "");
    box.querySelectorAll(".flavor-tag").forEach(tag => {
      if (tag.dataset.orderBound==="1") return;
      tag.dataset.orderBound = "1";
      tag.classList.add("selectable");
      const fname = (tag.getAttribute("data-flavor") || tag.textContent || "").trim();
      tag.setAttribute("data-flavor", fname);
      const minus = document.createElement("button");
      minus.type="button"; minus.className="flavor-qty-minus"; minus.textContent="−";
      minus.onclick = e => { e.stopPropagation(); const cur = cart.find(i=>i.product===productName&&i.flavor===fname); setQty(productName, fname, unitPrice, (cur?.qty||0)-1); };
      tag.appendChild(minus);
      tag.onclick = e => { if (e.target===minus) return; e.stopPropagation(); const cur = cart.find(i=>i.product===productName&&i.flavor===fname); setQty(productName, fname, unitPrice, (cur?.qty||0)+1); };
    });
    refreshBadges();
  }

  function parsePrice(t) { if (!t) return 0; const m = String(t).replace(",",".").match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; }

  document.getElementById("order-submit").onclick = async () => {
    const err = document.getElementById("order-err");
    const name = document.getElementById("order-name").value.trim();
    if (!name) { err.textContent="Wpisz imię albo Instagram"; err.hidden=false; return; }
    if (totalQty()<1) { err.textContent="Wybierz smaki"; err.hidden=false; return; }
    err.hidden = true;

    const lines = cartLines();
    const order = {
      klient: name,
      platnosc: selectedPay,
      cena: totalPrice() + " zł",
      sztuk: String(totalQty()),
      smaki: lines.join("; "),
      czas: new Date().toISOString()
    };

    try {
      await fetch(SUPABASE_URL + "/rest/v1/zamowienia", {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": "Bearer " + SUPABASE_KEY,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(order)
      });
    } catch(e) {}

    cart = []; saveCart(); refreshBadges(); updateOrderBar();

    document.getElementById("order-submit").hidden = true;
    document.getElementById("order-name").style.display = "none";
    payUI.querySelector(".pay-options").style.display = "none";
    const done = document.getElementById("order-done");
    done.hidden = false;
    done.innerHTML = selectedPay === "przelew"
      ? `<p>✅ Zamówienie przyjęte</p><p style="color:#ccc;font-size:.9rem">Odezwij się na Instagramie<br><b>@blushvape_</b><br>i podaj dane do przelewu.</p><a href="${ORDER_IG_URL}" target="_blank" class="ig-btn">Otwórz Instagram</a>`
      : `<p>✅ Zamówienie zakończone</p><p style="color:#ccc;font-size:.9rem">${escapeHtml(lines.join("<br>"))}<br><b>${escapeHtml(order.cena)}</b> · gotówka</p>`;
  };

  function escapeHtml(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  const obs = new MutationObserver(() => {
    const box = document.getElementById("modal-flavors");
    if (box) enhanceFlavorTags(box);
    ensureOrderBar();
  });

  function boot() {
    const box = document.getElementById("modal-flavors");
    if (box) { obs.observe(box,{childList:true,subtree:true}); enhanceFlavorTags(box); }
    const modal = document.getElementById("modal");
    if (modal) obs.observe(modal,{attributes:true,attributeFilter:["class"],subtree:true});
    ensureOrderBar(); updateOrderBar();
  }
  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  const prev = window.openModal;
  if (typeof prev==="function") {
    window.openModal = function() {
      const r = prev.apply(this, arguments);
      setTimeout(()=>{ enhanceFlavorTags(document.getElementById("modal-flavors")); ensureOrderBar(); updateOrderBar(); },80);
      setTimeout(()=>{ enhanceFlavorTags(document.getElementById("modal-flavors")); updateOrderBar(); },400);
      return r;
    };
  }
})();
