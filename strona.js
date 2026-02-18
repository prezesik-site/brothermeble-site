/* BrotherMeble — prosta strona + oferta + koszyk + zamówienie przez Formspree.
   Uwaga: to jest wersja statyczna (bez logowania i bez "admina w kodzie").
   - Produkty są w tablicy DEFAULT_PRODUCTS (łatwo edytujesz).
   - Koszyk trzyma się w localStorage.
   - Checkout wysyła zamówienie przez Formspree (wstaw swoje ID w HTML).
*/

const CFG = {
  businessEmail: "brothermeble24@gmail.com",
  LS: {
    cart: "bm_cart_v4",
    heroImg: "bm_hero_img_v4",
    products: "bm_products_v4"
  }
};

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

function safeJSON(str, fallback){ try { return JSON.parse(str); } catch { return fallback; } }
function load(key, fallback){ return safeJSON(localStorage.getItem(key), fallback); }
function save(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
function money(v){ const n = Math.round(Number(v)||0); return n.toLocaleString("pl-PL")+" zł"; }
function esc(s){ return String(s??"").replace(/[&<>\"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c])); }

function toast(msg){
  const el = $("#toast");
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
  $("#nav").classList.remove("show");
}

/* -------------------------
   HERO IMAGE (lokalnie)
--------------------------*/
function applyHeroFromStorage(){
  const imgData = localStorage.getItem(CFG.LS.heroImg);
  const img = $("#heroImg");
  const ph = $("#heroPlaceholder");
  if(imgData){
    img.src = imgData;
    img.style.display = "block";
    ph.style.display = "none";
  } else {
    img.removeAttribute("src");
    img.style.display = "none";
    ph.style.display = "flex";
  }
}

/* -------------------------
   PRODUCTS
--------------------------*/
const DEFAULT_PRODUCTS = [
  { id:"lozko-marco", type:"lozko", name:"Łóżko Marco", price:2699, pop:90, tags:["160x200","pojemnik"], desc:"Nowoczesne łóżko tapicerowane. Opcjonalny pojemnik na pościel.", img:null },
  { id:"lozko-slim-edge", type:"lozko", name:"Łóżko Slim Edge", price:2399, pop:85, tags:["140x200","160x200"], desc:"Smukła forma, idealna do mniejszych sypialni. Premium wygląd.", img:null },
  { id:"materac-active-160", type:"materac", name:"Materac Active 160×200", price:1099, pop:80, tags:["160x200","kieszeniowy"], desc:"Kieszeniowy + pianka. Stabilne podparcie, dobry komfort.", img:null },
  { id:"materac-comfort-140", type:"materac", name:"Materac Comfort 140×200", price:899, pop:70, tags:["140x200","pianka"], desc:"Piankowy materac do codziennego użytkowania.", img:null },
];

function ensureInit(){
  if(!localStorage.getItem(CFG.LS.products)) save(CFG.LS.products, DEFAULT_PRODUCTS);
  if(!localStorage.getItem(CFG.LS.cart)) save(CFG.LS.cart, []);
}

function getProducts(){
  const p = load(CFG.LS.products, null);
  if(Array.isArray(p) && p.length) return p;
  save(CFG.LS.products, DEFAULT_PRODUCTS);
  return DEFAULT_PRODUCTS.slice();
}
function findProduct(id){ return getProducts().find(p=>p.id===id); }

function renderProducts(){
  const grid = $("#productsGrid");
  const q = ($("#offerSearch").value||"").trim().toLowerCase();
  const type = $("#offerType").value;
  const sort = $("#offerSort").value;

  let list = getProducts().slice();
  if(type !== "all") list = list.filter(p=>p.type===type);

  if(q){
    list = list.filter(p=>{
      const hay = (p.name+" "+p.desc+" "+(p.tags||[]).join(" ")).toLowerCase();
      return hay.includes(q);
    });
  }

  if(sort === "pop") list.sort((a,b)=>(b.pop||0)-(a.pop||0));
  if(sort === "priceAsc") list.sort((a,b)=>(a.price||0)-(b.price||0));
  if(sort === "priceDesc") list.sort((a,b)=>(b.price||0)-(a.price||0));

  grid.innerHTML = "";
  if(list.length === 0){
    grid.innerHTML = `<div class="card">Brak wyników.</div>`;
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
        <p class="pd">${esc(p.desc)}</p>
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
function getCart(){ return load(CFG.LS.cart, []); }
function setCart(cart){ save(CFG.LS.cart, cart); }
function cartCount(){ return getCart().reduce((s,it)=> s + (it.qty||0), 0); }
function renderCartBadge(){ $("#cartCount").textContent = String(cartCount()); }

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
    return sum + (p ? p.price : 0) * (it.qty||0);
  }, 0);
  const shipping = subtotal === 0 ? 0 : (subtotal >= 3000 ? 0 : 149);
  return { subtotal, shipping, total: subtotal + shipping };
}
function renderCartList(){
  const wrap = $("#cartList");
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
function boot(){
  ensureInit();
  $("#year").textContent = new Date().getFullYear();

  applyHeroFromStorage();
  renderProducts();
  renderCartBadge();
  renderCartList();
  renderCheckoutSummary();

  // nav
  $$(".navBtn, .brand").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      e.preventDefault();
      const key = btn.dataset.nav || "home";
      showPage(key);
    });
  });

  // mobile nav
  $("#hamb").addEventListener("click", ()=> $("#nav").classList.toggle("show"));

  // offer tools
  $("#offerSearch").addEventListener("input", renderProducts);
  $("#offerType").addEventListener("change", renderProducts);
  $("#offerSort").addEventListener("change", renderProducts);

  // hero upload
  $("#heroFile").addEventListener("change", (e)=>{
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      localStorage.setItem(CFG.LS.heroImg, String(reader.result));
      applyHeroFromStorage();
      toast("Wstawiono zdjęcie (hero)");
    };
    reader.readAsDataURL(f);
    e.target.value = "";
  });
  $("#heroClear").addEventListener("click", ()=>{
    localStorage.removeItem(CFG.LS.heroImg);
    applyHeroFromStorage();
    toast("Usunięto zdjęcie (hero)");
  });

  // cart drawer
  const drawer = $("#drawerBack");
  $("#cartOpen").addEventListener("click", ()=> open(drawer));
  $("#cartClose").addEventListener("click", ()=> close(drawer));
  drawer.addEventListener("click", (e)=>{ if(e.target === drawer) close(drawer); });
  $("#cartClear").addEventListener("click", ()=>{ clearCart(); toast("Wyczyszczono koszyk"); });

  // checkout
  const checkout = $("#checkoutBack");
  $("#checkoutOpen").addEventListener("click", ()=>{
    if(getCart().length === 0){ toast("Koszyk pusty"); return; }
    close(drawer);
    open(checkout);
    renderCheckoutSummary();
  });
  $("#checkoutClose").addEventListener("click", ()=> close(checkout));
  checkout.addEventListener("click", (e)=>{ if(e.target === checkout) close(checkout); });

  // checkout submit: after successful Formspree post, clear cart
  $("#checkoutForm").addEventListener("submit", (e)=>{
    const pc = String(new FormData(e.target).get("postalCode")||"").trim();
    if(!/^\d{2}-\d{3}$/.test(pc)){
      e.preventDefault();
      toast("Kod pocztowy ma mieć format 00-000");
      return;
    }
    // wypełnij ukryte podsumowanie
    const hidden = $("#orderSummaryField");
    if(hidden) hidden.value = buildOrderSummary();

    // pozwól wysłać normalnie (POST). Po wysłaniu Formspree zwykle przekieruje.
    // Jeśli chcesz zostać na stronie: w kolejnym kroku dodamy fetch + podziękowanie bez przejścia.
    clearCart();
  });

  // contact: pozwól wysłać normalnie (POST). Formspree ogarnie.
  $("#contactForm").addEventListener("submit", ()=>{
    toast("Wysyłam wiadomość…");
  });

  // clicks (products + cart)
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

    if(e.key === "Escape"){
      close(drawer); close(checkout);
    }
  });

  // start
  showPage("home");
}

boot();