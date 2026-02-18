/* BrotherMeble — czysta wersja:
   - produkty z /content/products.json (Decap CMS)
   - koszyk w localStorage
   - brak publicznego uploadu hero
*/

const CFG = {
  LS: { cart: "bm_cart_v5" }
};

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

function safeJSON(str, fallback){ try { return JSON.parse(str); } catch { return fallback; } }
function load(key, fallback){ return safeJSON(localStorage.getItem(key), fallback); }
function save(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
function esc(s){ return String(s ?? "").replace(/[&<>\"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c])); }
function money(v){ const n = Math.round(Number(v)||0); return n.toLocaleString("pl-PL")+" zł"; }

function toast(msg){
  const el = $("#toast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(window.__t);
  window.__t = setTimeout(()=> el.classList.remove("show"), 2400);
}

/* -------------------------
   NAV
--------------------------*/
function showPage(key){
  $$(".page").forEach(p => p.classList.remove("show"));
  const el = document.getElementById("page-"+key);
  if(el) el.classList.add("show");
  $$(".navBtn").forEach(b => b.classList.toggle("active", b.dataset.nav === key));
  $("#nav")?.classList.remove("show");
}
function bindNav(){
  $$(".navBtn, .brand").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      const key = btn.dataset.nav;
      if(!key) return; // np. link do /admin
      e.preventDefault();
      showPage(key);
    });
  });
  $("#hamb")?.addEventListener("click", ()=> $("#nav")?.classList.toggle("show"));
}

/* -------------------------
   PRODUCTS (CMS)
--------------------------*/
let PRODUCTS_CACHE = [];

async function loadProductsRemote(){
  try{
    const res = await fetch("/content/products.json", { cache: "no-store" });
    if(!res.ok) throw new Error("HTTP "+res.status);
    const data = await res.json();
    const list = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
    PRODUCTS_CACHE = Array.isArray(list) ? list : [];
  } catch(e){
    PRODUCTS_CACHE = [];
  }
}

function getProducts(){ return PRODUCTS_CACHE.slice(); }
function findProduct(id){ return getProducts().find(p => p.id === id); }

function renderProducts(){
  const grid = $("#productsGrid");
  if(!grid) return;

  const q = ($("#offerSearch")?.value || "").trim().toLowerCase();
  const type = $("#offerType")?.value || "all";
  const sort = $("#offerSort")?.value || "pop";

  let list = getProducts();

  if(type !== "all") list = list.filter(p => p.type === type);

  if(q){
    list = list.filter(p=>{
      const hay = (p.name+" "+(p.desc||"")+" "+(p.tags||[]).join(" ")).toLowerCase();
      return hay.includes(q);
    });
  }

  if(sort === "pop") list.sort((a,b)=>(b.pop||0)-(a.pop||0));
  if(sort === "priceAsc") list.sort((a,b)=>(a.price||0)-(b.price||0));
  if(sort === "priceDesc") list.sort((a,b)=>(b.price||0)-(a.price||0));

  grid.innerHTML = "";

  if(list.length === 0){
    grid.innerHTML = `<div class="card">Brak produktów do wyświetlenia.</div>`;
    return;
  }

  list.forEach(p=>{
    const imgHtml = p.img ? `<img class="pimg" src="${esc(p.img)}" alt="${esc(p.name)}" />` : "";
    const el = document.createElement("article");
    el.className = "prod";
    el.innerHTML = `
      <div class="thumb">${imgHtml}</div>
      <div class="body">
        <h3 class="pt">${esc(p.name)}</h3>
        <p class="pd">${esc(p.desc || "")}</p>
        <div class="pm">
          <span>${p.type === "lozko" ? "Łóżko" : "Materac"}</span>
          <span>•</span>
          <span>${esc((p.tags||[]).slice(0,3).join(", ") || "—")}</span>
        </div>
        <div class="bottom">
          <div class="price">${money(p.price)}</div>
          <div class="actions">
            <button class="mBtn primary" data-add="${esc(p.id)}">Dodaj do koszyka</button>
          </div>
        </div>
      </div>
    `;
    grid.appendChild(el);
  });
}

/* -------------------------
   CART
--------------------------*/
function ensureInit(){
  if(!localStorage.getItem(CFG.LS.cart)) save(CFG.LS.cart, []);
}
function getCart(){ return load(CFG.LS.cart, []); }
function setCart(cart){ save(CFG.LS.cart, cart); }
function cartCount(){ return getCart().reduce((s,it)=> s + (it.qty||0), 0); }
function renderCartBadge(){ const el=$("#cartCount"); if(el) el.textContent = String(cartCount()); }

function addToCart(id){
  const cart = getCart().slice();
  const ex = cart.find(x=>x.id===id);
  if(ex) ex.qty += 1;
  else cart.push({id, qty:1});
  setCart(cart);
  renderCartBadge();
  renderCartList();
  renderCheckoutSummary();
  toast("Dodano do koszyka");
}
function setQty(id, qty){
  let cart = getCart().map(it => it.id===id ? ({...it, qty}) : it).filter(it => it.qty>0);
  setCart(cart);
  renderCartBadge();
  renderCartList();
  renderCheckoutSummary();
}
function clearCart(){
  setCart([]);
  renderCartBadge();
  renderCartList();
  renderCheckoutSummary();
}

function calcTotals(cart){
  const products = getProducts();
  const subtotal = cart.reduce((sum,it)=>{
    const p = products.find(x=>x.id===it.id);
    return sum + (p ? (p.price||0) : 0) * (it.qty||0);
  }, 0);
  const shipping = subtotal === 0 ? 0 : (subtotal >= 3000 ? 0 : 149);
  return { subtotal, shipping, total: subtotal + shipping };
}

function renderCartList(){
  const wrap = $("#cartList");
  if(!wrap) return;

  const cart = getCart();
  wrap.innerHTML = "";

  if(cart.length === 0){
    wrap.innerHTML = `<div class="card">Koszyk jest pusty.</div>`;
  } else {
    cart.forEach(it=>{
      const p = findProduct(it.id);
      const name = p ? p.name : it.id;
      const price = p ? p.price : 0;

      const row = document.createElement("div");
      row.className = "cItem";
      row.innerHTML = `
        <div>
          <div class="cName">${esc(name)}</div>
          <div class="cMeta">${money(price)} • ${esc(it.id)}</div>
        </div>
        <div class="qty">
          <button class="qBtn" data-qty="dec" data-id="${esc(it.id)}">−</button>
          <div class="qVal">${it.qty}</div>
          <button class="qBtn" data-qty="inc" data-id="${esc(it.id)}">+</button>
        </div>
      `;
      wrap.appendChild(row);
    });
  }

  const totals = calcTotals(cart);
  $("#subTotal").textContent = money(totals.subtotal);
  $("#shipTotal").textContent = money(totals.shipping);
  $("#grandTotal").textContent = money(totals.total);
}

/* -------------------------
   CHECKOUT (Formspree)
--------------------------*/
function buildOrderSummary(){
  const cart = getCart();
  const totals = calcTotals(cart);
  const lines = cart.map(it=>{
    const p = findProduct(it.id);
    const name = p ? p.name : it.id;
    const price = p ? p.price : 0;
    return `${name} | ${it.qty} × ${price} PLN = ${it.qty*price} PLN`;
  });
  lines.push(`Suma: ${totals.subtotal} PLN`);
  lines.push(`Dostawa: ${totals.shipping} PLN`);
  lines.push(`Razem: ${totals.total} PLN`);
  return lines.join("\n");
}

function renderCheckoutSummary(){
  const box = $("#summary");
  if(!box) return;

  const cart = getCart();
  if(cart.length === 0){
    box.innerHTML = `<div>Brak produktów w koszyku.</div>`;
    const hidden = $("#orderSummaryField"); if(hidden) hidden.value = "";
    return;
  }
  const totals = calcTotals(cart);

  const lines = cart.map(it=>{
    const p = findProduct(it.id);
    const name = p ? p.name : it.id;
    const sum = (p ? p.price : 0) * (it.qty||0);
    return `<div>${esc(name)} — ${it.qty} × ${money(p?.price||0)} = <strong>${money(sum)}</strong></div>`;
  });

  lines.push(`<div style="margin:10px 0;border-top:1px dashed #d6dced"></div>`);
  lines.push(`<div>Suma: <strong>${money(totals.subtotal)}</strong></div>`);
  lines.push(`<div>Dostawa: <strong>${money(totals.shipping)}</strong></div>`);
  lines.push(`<div>Razem: <strong>${money(totals.total)}</strong></div>`);
  box.innerHTML = lines.join("");

  const hidden = $("#orderSummaryField");
  if(hidden) hidden.value = buildOrderSummary();
}

/* -------------------------
   OVERLAYS
--------------------------*/
function open(el){ el.classList.add("show"); el.setAttribute("aria-hidden","false"); }
function close(el){ el.classList.remove("show"); el.setAttribute("aria-hidden","true"); }

/* -------------------------
   BOOT
--------------------------*/
async function boot(){
  ensureInit();
  $("#year").textContent = new Date().getFullYear();

  await loadProductsRemote();
  renderProducts();

  renderCartBadge();
  renderCartList();
  renderCheckoutSummary();

  bindNav();

  // offer tools
  $("#offerSearch")?.addEventListener("input", renderProducts);
  $("#offerType")?.addEventListener("change", renderProducts);
  $("#offerSort")?.addEventListener("change", renderProducts);

  // drawers
  const drawer = $("#drawerBack");
  $("#cartOpen")?.addEventListener("click", ()=> open(drawer));
  $("#cartClose")?.addEventListener("click", ()=> close(drawer));
  drawer?.addEventListener("click", (e)=>{ if(e.target === drawer) close(drawer); });

  $("#cartClear")?.addEventListener("click", ()=>{ clearCart(); toast("Wyczyszczono koszyk"); });

  const checkout = $("#checkoutBack");
  $("#checkoutOpen")?.addEventListener("click", ()=>{
    if(getCart().length === 0){ toast("Koszyk pusty"); return; }
    close(drawer);
    open(checkout);
    renderCheckoutSummary();
  });
  $("#checkoutClose")?.addEventListener("click", ()=> close(checkout));
  checkout?.addEventListener("click", (e)=>{ if(e.target === checkout) close(checkout); });

  // checkout validation
  $("#checkoutForm")?.addEventListener("submit", (e)=>{
    const pc = String(new FormData(e.target).get("postalCode")||"").trim();
    if(!/^\d{2}-\d{3}$/.test(pc)){
      e.preventDefault();
      toast("Kod pocztowy ma mieć format 00-000");
      return;
    }
    const hidden = $("#orderSummaryField");
    if(hidden) hidden.value = buildOrderSummary();
  });

  // clicks (products + cart qty)
  document.addEventListener("click", (e)=>{
    const add = e.target.closest("[data-add]");
    if(add){ addToCart(add.dataset.add); return; }

    const q = e.target.closest("[data-qty]");
    if(q){
      const id = q.dataset.id;
      const cart = getCart();
      const it = cart.find(x=>x.id===id);
      if(!it) return;
      if(q.dataset.qty === "inc") setQty(id, it.qty + 1);
      if(q.dataset.qty === "dec") setQty(id, it.qty - 1);
      return;
    }
  });

  showPage("home");
}

boot();
