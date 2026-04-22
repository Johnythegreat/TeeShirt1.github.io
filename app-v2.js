import { db, auth, firebaseReady, ADMIN_EMAILS } from "./firebase-config.js";
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, onSnapshot, serverTimestamp, query, orderBy, runTransaction, writeBatch, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const page = document.body.dataset.page;
const storage = getStorage();
const PRODUCTS_KEY = "tee_shirt_products";
const CART_KEY = "tee_shirt_cart";
const ACCOUNT_KEY = "tee_shirt_account";
const CUSTOMERS_KEY = "tee_shirt_customers";
const ORDERS_KEY = "tee_shirt_orders";
const HISTORY_KEY = "tee_shirt_order_history";
const MESSAGES_KEY = "tee_shirt_messages";
const MODE_KEY = "tee_shirt_mode";
const categories = ["All","Oversized","Vintage","Minimal","Anime","Couple","New Arrival"];
const demoProducts = [
  {
    name:"Premium Oversized Black Tee",
    brand:"TEE SHIRT",
    category:"Oversized",
    price:250,
    oldPrice:349,
    stock:25,
    sold:"120+ sold",
    badge:"Bulk Deal",
    image:"https://images.unsplash.com/photo-1521572179197-9c2b31b95f4c?auto=format&fit=crop&w=800&q=80",
    images:[
      "https://images.unsplash.com/photo-1521572179197-9c2b31b95f4c?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=800&q=80"
    ]
  },
  {
    name:"Vintage Washed Graphic Shirt",
    brand:"TEE SHIRT",
    category:"Vintage",
    price:280,
    oldPrice:389,
    stock:12,
    sold:"86+ sold",
    badge:"Promo",
    image:"https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80",
    images:[
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80"
    ]
  },
  {
    name:"Minimal White Essential Tee",
    brand:"TEE SHIRT",
    category:"Minimal",
    price:250,
    oldPrice:299,
    stock:34,
    sold:"200+ sold",
    badge:"Best Seller",
    image:"https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80",
    images:[
      "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1562157873-818bc0726f68?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=800&q=80"
    ]
  },
  {
    name:"Anime Street Print Oversized",
    brand:"TEE SHIRT",
    category:"Anime",
    price:320,
    oldPrice:399,
    stock:8,
    sold:"64+ sold",
    badge:"New",
    image:"https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=800&q=80",
    images:[
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80"
    ]
  }
];
const $ = (id) => document.getElementById(id);
const readJSON = (k, f) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch { return f; } };
const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const money = (v) => "₱" + Number(v || 0).toLocaleString();
const totalAmount = (items) => items.reduce((s, i) => s + Number(i.price) * Number(i.qty), 0) + (items.length ? 60 : 0);
const escapeHtml = (v) => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
function showNotice(text){ const el = $("notice"); if(!el) return; el.textContent = text; el.style.display = "block"; clearTimeout(window.__teeNoticeTimer); window.__teeNoticeTimer = setTimeout(() => el.style.display = "none", 2000); }
function getMode(){ const saved = readJSON(MODE_KEY, null); if(saved==="local"||saved==="firebase") return saved; return firebaseReady ? "firebase" : "local"; }
function setMode(mode){ writeJSON(MODE_KEY, mode); }
const getLocalProducts = () => readJSON(PRODUCTS_KEY, []);
const setLocalProducts = (items) => writeJSON(PRODUCTS_KEY, items);
const getLocalOrders = () => readJSON(ORDERS_KEY, []);
const setLocalOrders = (items) => writeJSON(ORDERS_KEY, items);
const getLocalHistory = () => readJSON(HISTORY_KEY, []);
const setLocalHistory = (items) => writeJSON(HISTORY_KEY, items);
const getLocalCustomers = () => readJSON(CUSTOMERS_KEY, []);
const setLocalCustomers = (items) => writeJSON(CUSTOMERS_KEY, items);
const getLocalMessages = () => readJSON(MESSAGES_KEY, []);
const setLocalMessages = (items) => writeJSON(MESSAGES_KEY, items);
function seedLocalIfEmpty(){ if(!getLocalProducts().length){ setLocalProducts(demoProducts.map((item, index) => ({ ...item, id: "p" + (index + 1) }))); } }
function bindNoticeButtons(){ document.querySelectorAll(".js-notice").forEach(btn => btn.onclick = () => showNotice(btn.dataset.text || "Done")); }
async function fetchFirebaseDocs(col, field=null){ const ref = collection(db, col); const q = field ? query(ref, orderBy(field, "desc")) : ref; const snap = await getDocs(q); return snap.docs.map(d => ({ id:d.id, ...d.data() })); }
function storageSync(callback){ const h = () => callback(); window.addEventListener("storage", h); return () => window.removeEventListener("storage", h); }
async function saveProduct(payload, docId){
  if(getMode()==="firebase" && firebaseReady){
    if(docId){ await updateDoc(doc(db, "products", docId), payload); return docId; }
    const ref = await addDoc(collection(db, "products"), { ...payload, createdAt: serverTimestamp() }); return ref.id;
  }
  const items = getLocalProducts();
  if(docId){ const idx = items.findIndex(x => x.id === docId); if(idx >= 0) items[idx] = { ...items[idx], ...payload, id: docId }; }
  else items.unshift({ ...payload, id: String(Date.now()) });
  setLocalProducts(items); return docId || items[0].id;
}
async function deleteProductItem(docId){
  if(getMode()==="firebase" && firebaseReady){ await deleteDoc(doc(db, "products", docId)); return; }
  setLocalProducts(getLocalProducts().filter(x => x.id !== docId));
}
async function seedProducts(){
  if(getMode()==="firebase" && firebaseReady){
    const current = await fetchFirebaseDocs("products", "createdAt");
    if(current.length) throw new Error("Products already exist");
    const batch = writeBatch(db);
    demoProducts.forEach(item => { const ref = doc(collection(db, "products")); batch.set(ref, { ...item, createdAt: serverTimestamp() }); });
    await batch.commit(); return;
  }
  if(getLocalProducts().length) throw new Error("Products already exist");
  seedLocalIfEmpty();
}
async function saveCustomerProfile(account){
  if(getMode()==="firebase" && firebaseReady && account.phone){ await setDoc(doc(db, "customers_public", account.phone), { ...account, updatedAt: serverTimestamp() }, { merge:true }); }
  const customers = getLocalCustomers(); const idx = customers.findIndex(c => c.phone === account.phone && account.phone); if(idx >= 0) customers[idx] = account; else customers.unshift(account); setLocalCustomers(customers);
}
async function createOrder(cart, account){
  if(getMode()==="firebase" && firebaseReady){
    await runTransaction(db, async (transaction) => {
      const liveItems = [];
      for(const item of cart){
        const ref = doc(db, "products", item.id); const snap = await transaction.get(ref);
        if(!snap.exists()) throw new Error(item.name + " not found");
        const data = snap.data(); const stock = Number(data.stock || 0);
        if(stock < Number(item.qty)) throw new Error("Not enough stock for " + item.name);
        transaction.update(ref, { stock: stock - Number(item.qty) });
        liveItems.push({ name:data.name, qty:Number(item.qty), price:Number(data.price), productId:item.id, size:item.size || "M" });
      }
      const orderRef = doc(collection(db, "orders"));
      transaction.set(orderRef, { customer:account, items:liveItems, total:totalAmount(liveItems), status:"Pending", createdAt:serverTimestamp() });
    });
    return;
  }
  const products = getLocalProducts();
  for(const item of cart){ const p = products.find(x => x.id === item.id); if(!p || Number(p.stock) < Number(item.qty)) throw new Error("Not enough stock for " + item.name); }
  for(const item of cart){ const p = products.find(x => x.id === item.id); p.stock = Number(p.stock) - Number(item.qty); }
  setLocalProducts(products);
  const orders = getLocalOrders();
  orders.unshift({ id:"ORD-" + Date.now(), customer:account, items:cart.map(i => ({ name:i.name, qty:Number(i.qty), price:Number(i.price), size:i.size || "M" })), total:totalAmount(cart), status:"Pending", createdAt:new Date().toISOString() });
  setLocalOrders(orders);
}
async function updateOrderStatus(orderId, newStatus, activeOrdersCache=[]){
  if(getMode()==="firebase" && firebaseReady){
    const order = activeOrdersCache.find(x => x.id === orderId); if(!order) return;
    if(newStatus === "Completed"){ await setDoc(doc(db, "order_history", orderId), { ...order, status:"Completed", movedAt:serverTimestamp() }); await deleteDoc(doc(db, "orders", orderId)); return; }
    await updateDoc(doc(db, "orders", orderId), { status:newStatus }); return;
  }
  const orders = getLocalOrders(); const idx = orders.findIndex(o => o.id === orderId); if(idx < 0) return;
  if(newStatus === "Completed"){ const history = getLocalHistory(); history.unshift({ ...orders[idx], status:"Completed", movedAt:new Date().toISOString() }); setLocalHistory(history); orders.splice(idx,1); setLocalOrders(orders); return; }
  orders[idx].status = newStatus; setLocalOrders(orders);
}
async function moveOrderToHistory(orderId, activeOrdersCache=[]){
  if(getMode()==="firebase" && firebaseReady){
    const order = activeOrdersCache.find(x => x.id === orderId); if(!order) return;
    await setDoc(doc(db, "order_history", orderId), { ...order, status:order.status || "Removed", movedAt:serverTimestamp() }); await deleteDoc(doc(db, "orders", orderId)); return;
  }
  const orders = getLocalOrders(); const idx = orders.findIndex(o => o.id === orderId); if(idx < 0) return;
  const history = getLocalHistory(); history.unshift({ ...orders[idx], status:orders[idx].status || "Removed", movedAt:new Date().toISOString() }); setLocalHistory(history); orders.splice(idx,1); setLocalOrders(orders);
}
function subscribeProducts(callback){
  if(getMode()==="firebase" && firebaseReady){
    return onSnapshot(query(collection(db, "products"), orderBy("createdAt", "desc")), (snapshot) => callback(snapshot.docs.map(d => ({ id:d.id, ...d.data() })), "firebase"), () => { seedLocalIfEmpty(); callback(getLocalProducts(), "local"); });
  }
  seedLocalIfEmpty(); callback(getLocalProducts(), "local"); return storageSync(() => callback(getLocalProducts(), "local"));
}
function subscribeOrders(callback){
  if(getMode()==="firebase" && firebaseReady){
    return onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), async (snapshot) => {
      let history = []; try { history = await fetchFirebaseDocs("order_history", "movedAt"); } catch {}
      callback(snapshot.docs.map(d => ({ id:d.id, ...d.data() })), history, "firebase");
    }, () => callback(getLocalOrders(), getLocalHistory(), "local"));
  }
  callback(getLocalOrders(), getLocalHistory(), "local"); return storageSync(() => callback(getLocalOrders(), getLocalHistory(), "local"));
}
function subscribeCustomers(callback){
  if(getMode()==="firebase" && firebaseReady){
    return onSnapshot(query(collection(db, "customers_public"), orderBy("updatedAt", "desc")), (snapshot) => callback(snapshot.docs.map(d => ({ id:d.id, ...d.data() })), "firebase"), () => callback(getLocalCustomers(), "local"));
  }
  callback(getLocalCustomers(), "local"); return storageSync(() => callback(getLocalCustomers(), "local"));
}
function isAdminEmail(email){
  return ADMIN_EMAILS.map(x => x.toLowerCase()).includes(String(email || "").toLowerCase());
}

function requireAdminGuard(){
  if(!firebaseReady || !auth){
    showNotice("Firebase Auth is not ready");
    return;
  }
  onAuthStateChanged(auth, (user) => {
    if(!user || !isAdminEmail(user.email)){
      window.location.href = "./admin-login.html";
      return;
    }
    initAdmin();
  });
}

function initAdminLogin(){
  const form = $("adminLoginForm");
  form.onsubmit = async (e) => {
    e.preventDefault();
    if(!firebaseReady || !auth){
      showNotice("Firebase Auth is not ready");
      return;
    }
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if(!isAdminEmail(cred.user.email)){
        await signOut(auth);
        showNotice("This account is not allowed as admin");
        return;
      }
      window.location.href = "./admin.html";
    } catch (error) {
      showNotice("Login failed. Check email/password.");
    }
  };
}



async function compressImageFile(file){
  const maxInputBytes = 2 * 1024 * 1024;
  if(file.size > maxInputBytes) throw new Error("Image too large. Max 2MB.");
  const bitmap = await createImageBitmap(file);
  const maxSide = 1280;
  const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  let quality = 0.72;
  let blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
  while(blob && blob.size > 280 * 1024 && quality > 0.42){
    quality -= 0.08;
    blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
  }
  return blob;
}

async function uploadChatImage(file){
  if(!file) return "";
  if(getMode() !== "firebase" || !firebaseReady){
    throw new Error("Image upload needs Firebase mode.");
  }
  const blob = await compressImageFile(file);
  const storageRef = ref(storage, "chatImages/" + Date.now() + "_" + Math.random().toString(36).slice(2) + ".jpg");
  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
  return await getDownloadURL(storageRef);
}

async function previewCompressedImage(file){
  const blob = await compressImageFile(file);
  return URL.createObjectURL(blob);
}

function renderImagePreview(areaId, inputId, stateKey){
  const area = $(areaId);
  if(!area) return;
  const url = window[stateKey];
  if(!url){
    area.classList.add("hidden");
    area.innerHTML = "";
    return;
  }
  area.classList.remove("hidden");
  area.innerHTML = `<div class="image-preview-card"><img src="${url}" alt="Selected image"><button class="image-preview-remove" type="button" id="${areaId}_remove">✕</button></div>`;
  const btn = $(`${areaId}_remove`);
  if(btn){
    btn.onclick = () => {
      window[stateKey] = "";
      const input = $(inputId);
      if(input) input.value = "";
      renderImagePreview(areaId, inputId, stateKey);
    };
  }
}

async function saveInquiryMessage(payload){
  if(getMode()==="firebase" && firebaseReady){
    await addDoc(collection(db, "messages"), { ...payload, status:"New", image: payload.image || "", createdAt:serverTimestamp() });
    return;
  }
  const items = getLocalMessages();
  items.unshift({ id:"MSG-" + Date.now(), ...payload, status:"New", image: payload.image || "", createdAt:new Date().toISOString() });
  setLocalMessages(items);
}

async function updateMessageStatus(messageId, newStatus, cache=[]){
  if(getMode()==="firebase" && firebaseReady){
    await updateDoc(doc(db, "messages", messageId), { status:newStatus });
    return;
  }
  const items = getLocalMessages();
  const idx = items.findIndex(x => x.id === messageId);
  if(idx >= 0){
    items[idx].status = newStatus;
    setLocalMessages(items);
  }
}

function subscribeMessages(callback){
  if(getMode()==="firebase" && firebaseReady){
    return onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "desc")), (snapshot) => {
      callback(snapshot.docs.map(d => ({ id:d.id, ...d.data() })), "firebase");
    }, () => callback(getLocalMessages(), "local"));
  }
  callback(getLocalMessages(), "local");
  return storageSync(() => callback(getLocalMessages(), "local"));
}


if(document.getElementById("adminLoginForm")) initAdminLogin();
else if(page === "shop") initShop();
else if(page === "admin") requireAdminGuard();



function initShop(){
  bindNoticeButtons();

  let currentCategory = "All";
  let products = [];
  let cart = readJSON(CART_KEY, []);
  let account = readJSON(ACCOUNT_KEY, {name:"", phone:"", email:"", address:""});
  let selectedProduct = null;
  let selectedSize = null;
  let detailQty = 1;

  const chipsEl = $("chips");
  const gridEl = $("productGrid");
  const sourceLabel = $("sourceLabel");
  const searchInput = $("searchInput");
  const drawer = $("drawer");
  const drawerTitle = $("drawerTitle");
  const cartView = $("cartView");
  const accountView = $("accountView");
  const productPageModal = $("productPageModal");

  function renderChips(){
    chipsEl.innerHTML = categories.map(cat => `<button class="chip ${cat===currentCategory?"active":""}" data-cat="${cat}">${cat}</button>`).join("");
    chipsEl.querySelectorAll(".chip").forEach(btn => {
      btn.onclick = () => {
        currentCategory = btn.dataset.cat;
        renderChips();
        renderProducts();
      };
    });
  }

  function renderProducts(){
    const q = (searchInput.value || "").trim().toLowerCase();
    const filtered = products.filter(p => {
      const categoryOk = currentCategory === "All" || p.category === currentCategory;
      const text = `${p.brand} ${p.name} ${p.category}`.toLowerCase();
      return categoryOk && (!q || text.includes(q));
    });

    if(!filtered.length){
      gridEl.innerHTML = '<div style="grid-column:1/-1" class="empty">No products found.</div>';
      return;
    }

    gridEl.innerHTML = filtered.map(p => `
      <article class="card" data-view="${p.id}">
        <div class="thumb" style="background-image:url('${p.image}')">
          <div class="badge">${escapeHtml(p.badge || "New")}</div>
          <button class="fav js-notice" data-text="Wishlist feature can be added next">♡</button>
        </div>
        <div class="card-body">
          <div class="brand">${escapeHtml(p.brand)}</div>
          <div class="name">${escapeHtml(p.name)}</div>
          <div class="meta">
            <span>${escapeHtml(p.category)}</span>
            <span>${escapeHtml(p.sold || "0 sold")}</span>
            <span>Stock: ${Number(p.stock || 0)}</span>
          </div>
          <div class="price-row">
            <div>
              <div class="price">${money(p.price)}</div>
              <div class="old">${money(p.oldPrice)}</div>
            </div>
            <button class="mini-btn" data-quick-add="${p.id}" ${Number(p.stock || 0)<=0 ? "disabled" : ""}>Quick Add</button>
          </div>
        </div>
      </article>
    `).join("");

    bindNoticeButtons();

    gridEl.querySelectorAll("[data-view]").forEach(card => {
      card.onclick = (e) => {
        if(e.target.closest("[data-quick-add]") || e.target.closest(".fav")) return;
        openProductPage(card.dataset.view);
      };
    });

    gridEl.querySelectorAll("[data-quick-add]").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        quickAdd(btn.dataset.quickAdd);
      };
    });
  }

  function quickAdd(id){
    const p = products.find(x => x.id === id);
    if(!p || Number(p.stock || 0) <= 0){
      showNotice("Product out of stock");
      return;
    }
    const existing = cart.find(x => x.id === id && x.size === "M");
    const currentQty = existing ? Number(existing.qty) : 0;
    if(currentQty >= Number(p.stock || 0)){
      showNotice("No more stock available");
      return;
    }
    if(existing) existing.qty += 1;
    else cart.push({ id:p.id, name:p.name, brand:p.brand, category:p.category, price:p.price, image:p.image, qty:1, size:"M" });
    writeJSON(CART_KEY, cart);
    renderCart();
    showNotice("Added to cart");
  }

  function wireSizeButtons(){
    document.querySelectorAll(".size-option").forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll(".size-option").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedSize = btn.dataset.size;
        $("selectedSizeLabel").textContent = "Selected: " + selectedSize;
      };
    });
  }

  function openProductPage(id){
    const p = products.find(x => x.id === id);
    if(!p) return;

    selectedProduct = p;
    selectedSize = null;
    detailQty = 1;

    const galleryImages = Array.isArray(p.images) && p.images.length ? p.images : [p.image, p.image, p.image];
    $("productPageMainImage").src = galleryImages[0] || p.image;
    $("productPageBadge").textContent = p.badge || "New";
    $("thumbImg1").src = galleryImages[0] || p.image;
    $("thumbImg2").src = galleryImages[1] || galleryImages[0] || p.image;
    $("thumbImg3").src = galleryImages[2] || galleryImages[0] || p.image;
    $("productPageBrand").textContent = p.brand || "TEE SHIRT";
    $("productPageName").textContent = p.name || "";
    $("productPagePrice").textContent = money(p.price);
    $("productPageOldPrice").textContent = money(p.oldPrice);
    $("productPageCategory").textContent = p.category || "Category";
    $("productPageSold").textContent = p.sold || "0 sold";
    $("productPageStock").textContent = "Stock: " + Number(p.stock || 0);
    $("productPageDescription").textContent =
      `${p.name} is ideal for bulk custom orders, business uniforms, event shirts, team wear, and giveaways. Clean presentation, strong print-ready look, and budget-friendly value starting at just ₱250.`;

    [$("thumbBtn1"), $("thumbBtn2"), $("thumbBtn3")].forEach((thumb, i) => {
      if(!thumb) return;
      thumb.classList.toggle("active", i === 0);
      thumb.onclick = () => {
        [$("thumbBtn1"), $("thumbBtn2"), $("thumbBtn3")].forEach(t => t && t.classList.remove("active"));
        thumb.classList.add("active");
        $("productPageMainImage").src = galleryImages[i] || galleryImages[0] || p.image;
      };
    });

    document.querySelectorAll(".size-option").forEach(btn => btn.classList.remove("active"));
    $("selectedSizeLabel").textContent = "No size selected";
    $("detailQtyValue").textContent = String(detailQty);
    updateDetailTotal();
    wireSizeButtons();

    productPageModal.classList.remove("hidden");
    const productScroll = document.querySelector(".product-page-scroll");
    if(productScroll) productScroll.scrollTop = 0;
    bindNoticeButtons();
  }

  function updateDetailTotal(){
    if(!selectedProduct){
      $("detailTotalPrice").textContent = "₱0";
      return;
    }
    $("detailTotalPrice").textContent = money(Number(selectedProduct.price || 0) * detailQty);
  }

  function closeProductPage(){
    if(productPageModal) productPageModal.classList.add("hidden");
  }

  function addDetailToCart(){
    if(!selectedProduct){
      showNotice("No product selected");
      return;
    }
    if(!selectedSize){
      showNotice("Please select size");
      return;
    }
    const stock = Number(selectedProduct.stock || 0);
    if(stock <= 0){
      showNotice("Product out of stock");
      return;
    }

    const existing = cart.find(x => x.id === selectedProduct.id && x.size === selectedSize);
    const currentQty = existing ? Number(existing.qty) : 0;
    if(currentQty + detailQty > stock){
      showNotice("Not enough stock available");
      return;
    }

    if(existing) existing.qty += detailQty;
    else cart.push({
      id:selectedProduct.id,
      name:selectedProduct.name,
      brand:selectedProduct.brand,
      category:selectedProduct.category,
      price:selectedProduct.price,
      image:selectedProduct.image,
      qty:detailQty,
      size:selectedSize
    });

    writeJSON(CART_KEY, cart);
    renderCart();
    closeProductPage();
    showNotice(`Added ${detailQty} item(s) - Size ${selectedSize}`);
  }

  function changeCartQtyByKey(id, size, delta){
    const live = products.find(x => x.id === id);
    const cartItem = cart.find(x => x.id === id && x.size === size);
    if(!cartItem || !live) return;

    const next = Number(cartItem.qty) + Number(delta);
    if(next <= 0){
      cart = cart.filter(x => !(x.id === id && x.size === size));
    } else if(next > Number(live.stock || 0)){
      showNotice("No more stock available");
      return;
    } else {
      cartItem.qty = next;
    }
    writeJSON(CART_KEY, cart);
    renderCart();
  }

  function removeItem(id, size){
    cart = cart.filter(x => !(x.id === id && x.size === size));
    writeJSON(CART_KEY, cart);
    renderCart();
    showNotice("Item removed");
  }

  function renderCart(){
    const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);
    const shipping = cart.length ? 60 : 0;
    const total = subtotal + shipping;

    if(!cart.length){
      cartView.innerHTML = '<div class="empty">Your cart is empty.</div>';
      return;
    }

    cartView.innerHTML = `
      ${cart.map(item => `
        <div class="cart-item">
          <div class="cart-thumb" style="background-image:url('${item.image}')"></div>
          <div>
            <div style="font-weight:800">${escapeHtml(item.name)}</div>
            <div class="small">${escapeHtml(item.brand)} • ${escapeHtml(item.category)} • Size: ${escapeHtml(item.size || "M")}</div>
            <div class="qty">
              <button data-minus="${item.id}" data-size="${escapeHtml(item.size || "M")}">−</button>
              <strong>${item.qty}</strong>
              <button data-plus="${item.id}" data-size="${escapeHtml(item.size || "M")}">+</button>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:900">${money(item.price * item.qty)}</div>
            <button class="icon-btn" style="margin-top:8px" data-remove="${item.id}" data-size="${escapeHtml(item.size || "M")}">🗑️</button>
          </div>
        </div>
      `).join("")}
      <div style="height:14px"></div>
      <div class="summary">
        <div class="summary-row"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
        <div class="summary-row"><span>Shipping</span><strong>${money(shipping)}</strong></div>
        <div class="summary-row" style="font-size:18px"><span>Total</span><strong>${money(total)}</strong></div>
        <button class="btn dark" style="width:100%;margin-top:10px" id="checkoutBtn">Checkout</button>
      </div>
    `;

    cartView.querySelectorAll("[data-minus]").forEach(btn => btn.onclick = () => changeCartQtyByKey(btn.dataset.minus, btn.dataset.size, -1));
    cartView.querySelectorAll("[data-plus]").forEach(btn => btn.onclick = () => changeCartQtyByKey(btn.dataset.plus, btn.dataset.size, 1));
    cartView.querySelectorAll("[data-remove]").forEach(btn => btn.onclick = () => removeItem(btn.dataset.remove, btn.dataset.size));
    $("checkoutBtn").onclick = checkout;
  }

  function renderAccount(){
    accountView.innerHTML = `
      <div class="account-box">
        <div class="small">This profile is saved in your browser now, and also syncs online in Firebase mode.</div>
        <div class="two">
          <div class="field">
            <label>Name</label>
            <input id="acc_name" value="${escapeHtml(account.name)}" placeholder="Your full name">
          </div>
          <div class="field">
            <label>Phone</label>
            <input id="acc_phone" value="${escapeHtml(account.phone)}" placeholder="09xxxxxxxxxx">
          </div>
        </div>
        <div class="field">
          <label>Email</label>
          <input id="acc_email" value="${escapeHtml(account.email)}" placeholder="you@example.com">
        </div>
        <div class="field">
          <label>Address</label>
          <input id="acc_address" value="${escapeHtml(account.address)}" placeholder="Complete address">
        </div>
        <div class="account-actions">
          <button class="btn dark full-btn" id="saveAccountBtn">Save Profile</button>
        </div>
      </div>
    `;
    $("saveAccountBtn").onclick = saveAccount;
  }

  async function saveAccount(){
    account = {
      name:$("acc_name").value.trim(),
      phone:$("acc_phone").value.trim(),
      email:$("acc_email").value.trim(),
      address:$("acc_address").value.trim()
    };
    writeJSON(ACCOUNT_KEY, account);
    try {
      await saveCustomerProfile(account);
      closeDrawer();
      showNotice("Profile saved");
    } catch {
      closeDrawer();
      showNotice("Saved locally");
    }
  }

  async function checkout(){
    if(!account.name || !account.phone){
      openDrawer("account");
      showNotice("Please fill your account details first");
      return;
    }
    if(!cart.length){
      showNotice("Your cart is empty");
      return;
    }
    try {
      await saveCustomerProfile(account);
      await createOrder(cart, account);
      cart = [];
      writeJSON(CART_KEY, cart);
      renderCart();
      closeDrawer();
      showNotice("Order placed");
    } catch (error) {
      showNotice(error.message || "Checkout failed");
    }
  }

  function openDrawer(type){
    drawer.classList.add("show");
    cartView.classList.add("hidden");
    accountView.classList.add("hidden");
    if(type==="cart"){
      drawerTitle.textContent="My Cart";
      cartView.classList.remove("hidden");
      renderCart();
    } else {
      drawerTitle.textContent="My Account";
      accountView.classList.remove("hidden");
      renderAccount();
    }
  }

  function closeDrawer(){ drawer.classList.remove("show"); }


  function openInquiry(){
    const modal = $("inquiryModal");
    if(!modal) return;
    $("inq_name").value = account.name || "";
    $("inq_phone").value = account.phone || "";
    $("inq_message").value = "";
    modal.classList.remove("hidden");
  }

  function closeInquiry(){
    const modal = $("inquiryModal");
    if(modal) modal.classList.add("hidden");
  }

  async function sendInquiry(){
    const name = ($("inq_name")?.value || "").trim();
    const phone = ($("inq_phone")?.value || "").trim();
    const message = ($("inq_message")?.value || "").trim();
    const file = $("customerImageInput")?.files?.[0] || null;

    if(!name || !phone || (!message && !file)){
      showNotice("Please complete the inquiry form");
      return;
    }

    try{
      let imageUrl = "";
      if(file) imageUrl = await uploadChatImage(file);
      await saveInquiryMessage({ name, phone, message, image: imageUrl });
      account = { ...account, name, phone };
      writeJSON(ACCOUNT_KEY, account);
      if($("inq_message")) $("inq_message").value = "";
      if($("customerImageInput")) $("customerImageInput").value = "";
      window.__customerPreview = "";
      renderImagePreview("customerPreviewArea", "customerImageInput", "__customerPreview");
      closeInquiry();
      showNotice("Message sent to admin");
    }catch(error){
      showNotice(error?.message || "Failed to send message");
    }
  }
  }


  subscribeProducts((items, source) => {
    products = items;
    sourceLabel.textContent = source==="firebase" ? "Live from Firebase" : "Using local fallback";
    renderProducts();
    renderCart();
  });

  renderChips();
  renderCart();
  bindNoticeButtons();

  $("searchBtn").onclick = renderProducts;
  searchInput.oninput = renderProducts;
  $("shopNowBtn").onclick = () => $("productsSection").scrollIntoView({behavior:"smooth"});
  $("openAccountBtn").onclick = () => openInquiry();
  $("openCartBtn").onclick = () => openDrawer("cart");
  if($("openInboxBtn")) $("openInboxBtn").onclick = () => openInquiry();
  $("navCart").onclick = () => openDrawer("cart");
  $("navAccount").onclick = () => openDrawer("account");
  $("navCategory").onclick = () => $("productsSection").scrollIntoView({behavior:"smooth"});
  $("navHome").onclick = () => window.scrollTo({top:0, behavior:"smooth"});
  $("closeDrawerBtn").onclick = closeDrawer;
  drawer.onclick = (e) => { if(e.target.id==="drawer") closeDrawer(); };

  if($("closeProductPageBtn")) $("closeProductPageBtn").onclick = closeProductPage;
  if(productPageModal) productPageModal.onclick = (e) => { if(e.target.id==="productPageModal") closeProductPage(); };
  if($("detailQtyMinus")) $("detailQtyMinus").onclick = () => {
    detailQty = Math.max(1, detailQty - 1);
    $("detailQtyValue").textContent = String(detailQty);
    updateDetailTotal();
  };
  if($("detailQtyPlus")) $("detailQtyPlus").onclick = () => {
    if(selectedProduct && detailQty < Number(selectedProduct.stock || 0)){
      detailQty += 1;
      $("detailQtyValue").textContent = String(detailQty);
      updateDetailTotal();
    } else {
      showNotice("No more stock available");
    }
  };
  if($("productPageAddToCartBtn")) $("productPageAddToCartBtn").onclick = addDetailToCart;
  if($("closeInquiryBtn")) $("closeInquiryBtn").onclick = closeInquiry;
  if($("sendInquiryBtn")) $("sendInquiryBtn").onclick = sendInquiry;
  if($("customerImageInput")) $("customerImageInput").onchange = async () => { const file = $("customerImageInput").files?.[0]; if(!file){ window.__customerPreview = ""; renderImagePreview("customerPreviewArea", "customerImageInput", "__customerPreview"); return; } try{ window.__customerPreview = await previewCompressedImage(file); renderImagePreview("customerPreviewArea", "customerImageInput", "__customerPreview"); }catch(error){ showNotice(error?.message || "Preview failed"); } };
  if($("inquiryModal")) $("inquiryModal").onclick = (e) => { if(e.target.id === "inquiryModal") closeInquiry(); };
}


function initAdmin(){
  bindNoticeButtons(); const form = $("productForm"), table = $("adminProductTable"); let activeOrdersCache = [];
  const topActions = document.querySelector(".top-actions-wrap");
  if(topActions && !document.getElementById("logoutAdminBtn")){
    const logoutBtn = document.createElement("button");
    logoutBtn.id = "logoutAdminBtn";
    logoutBtn.className = "btn dark";
    logoutBtn.textContent = "Logout";
    logoutBtn.onclick = async () => { try { await signOut(auth); } catch {} window.location.href = "./admin-login.html"; };
    topActions.appendChild(logoutBtn);
  }
  function updateStats(items){ $("statProducts").textContent = items.length; $("statStock").textContent = items.reduce((a,b)=>a+Number(b.stock||0),0); $("statLow").textContent = items.filter(x=>Number(x.stock||0)<=10).length; $("statCategories").textContent = new Set(items.map(x=>x.category)).size; }
  function clearForm(){ form.reset(); $("docId").value = ""; if($("image2")) $("image2").value=""; if($("image3")) $("image3").value=""; if($("image4")) $("image4").value=""; }
  function fillForm(item){ $("docId").value=item.id; $("name").value=item.name||""; $("brand").value=item.brand||""; $("category").value=item.category||"Oversized"; $("price").value=item.price||0; $("oldPrice").value=item.oldPrice||0; $("stock").value=item.stock||0; $("sold").value=item.sold||""; $("badge").value=item.badge||""; $("image").value=item.image||""; $("image2").value=(item.images&&item.images[1])||""; $("image3").value=(item.images&&item.images[2])||""; $("image4").value=(item.images&&item.images[3])||""; window.scrollTo({top:0, behavior:"smooth"}); }
  function renderProductsAdmin(items, source){ $("adminSourceLabel").textContent = source==="firebase" ? "Live from Firebase" : "Using local fallback"; updateStats(items); if(!items.length){ table.innerHTML = '<tr><td colspan="5" class="empty">No products found.</td></tr>'; return; } table.innerHTML = items.map(item => `<tr><td><div style="font-weight:800">${escapeHtml(item.name)}</div><div class="small">${escapeHtml(item.brand)}</div></td><td>${escapeHtml(item.category)}</td><td>${money(item.price)}</td><td>${Number(item.stock||0)}</td><td><div class="row-actions"><button class="btn ghost" data-edit="${item.id}">Edit</button><button class="btn dark" data-delete="${item.id}">Delete</button></div></td></tr>`).join(""); table.querySelectorAll("[data-edit]").forEach(btn => btn.onclick = () => { const item = items.find(x => x.id===btn.dataset.edit); if(item) fillForm(item); }); table.querySelectorAll("[data-delete]").forEach(btn => btn.onclick = async () => { try { await deleteProductItem(btn.dataset.delete); showNotice("Product deleted"); } catch { showNotice("Delete failed"); } }); }
  function renderOrders(activeOrders, historyOrders){ activeOrdersCache = activeOrders.slice(); const tbody = $("ordersTable"), historyBody = $("historyTable"); if(!tbody || !historyBody) return; if(!activeOrders.length) tbody.innerHTML = '<tr><td colspan="6" class="empty">No active orders yet.</td></tr>'; else { tbody.innerHTML = activeOrders.map(order => `<tr><td>${escapeHtml(order.id||"-")}</td><td><div style="font-weight:800">${escapeHtml(order.customer?.name||"-")}</div><div class="small">${escapeHtml(order.customer?.phone||"")}</div></td><td>${money(order.total||0)}</td><td><select class="order-status-select" data-order-status="${escapeHtml(order.id||"")}"><option value="Pending" ${order.status==="Pending"?"selected":""}>Pending</option><option value="Preparing" ${order.status==="Preparing"?"selected":""}>Preparing</option><option value="Ready" ${order.status==="Ready"?"selected":""}>Ready</option><option value="Completed" ${order.status==="Completed"?"selected":""}>Completed</option></select></td><td>${(order.items||[]).map(i => `${escapeHtml(i.name)} x${Number(i.qty)}`).join("<br>")}</td><td><button class="btn ghost" data-archive-order="${escapeHtml(order.id||"")}">Move to History</button></td></tr>`).join(""); tbody.querySelectorAll("[data-order-status]").forEach(select => select.onchange = async function(){ try { await updateOrderStatus(this.dataset.orderStatus, this.value, activeOrdersCache); showNotice(this.value==="Completed" ? "Order moved to history" : "Order status updated"); } catch { showNotice("Status update failed"); } }); tbody.querySelectorAll("[data-archive-order]").forEach(btn => btn.onclick = async () => { try { await moveOrderToHistory(btn.dataset.archiveOrder, activeOrdersCache); showNotice("Order moved to history"); } catch { showNotice("Move failed"); } }); } if(!historyOrders.length) historyBody.innerHTML = '<tr><td colspan="5" class="empty">No order history yet.</td></tr>'; else historyBody.innerHTML = historyOrders.map(order => `<tr><td>${escapeHtml(order.id||"-")}</td><td><div style="font-weight:800">${escapeHtml(order.customer?.name||"-")}</div><div class="small">${escapeHtml(order.customer?.phone||"")}</div></td><td>${money(order.total||0)}</td><td>${escapeHtml(order.status||"Completed")}</td><td>${(order.items||[]).map(i => `${escapeHtml(i.name)} x${Number(i.qty)}`).join("<br>")}</td></tr>`).join(""); }

  function renderMessages(messages){
    const tbody = $("messagesTable");
    if(!tbody) return;
    if(!messages.length){
      tbody.innerHTML = '<tr><td colspan="4" class="empty">No messages yet.</td></tr>';
      return;
    }
    tbody.innerHTML = messages.map(item => {
      const displayDate = item.createdAt?.seconds
        ? new Date(item.createdAt.seconds * 1000).toLocaleString()
        : (item.createdAt || "-");
      return `
      <tr>
        <td>
          <div style="font-weight:800">${escapeHtml(item.name || "-")}</div>
          <div class="small">${escapeHtml(item.phone || "-")}</div>
        </td>
        <td style="min-width:260px">
          <div style="margin-bottom:8px">${escapeHtml(item.message || "-")}</div>
          ${item.image ? `<img class="chat-image" src="${item.image}" alt="Customer image" />` : ""}
          ${item.reply ? `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed #ddd"><strong>Admin Reply:</strong><br>${escapeHtml(item.reply)}</div>` : ""}
          ${item.replyImage ? `<img class="chat-image" src="${item.replyImage}" alt="Reply image" />` : ""}
        </td>
        <td>
          <select class="order-status-select" data-message-status="${escapeHtml(item.id || "")}">
            <option value="New" ${item.status === "New" ? "selected" : ""}>New</option>
            <option value="Replied" ${item.status === "Replied" ? "selected" : ""}>Replied</option>
          </select>
          <textarea class="admin-reply-box" data-message-reply="${escapeHtml(item.id || "")}" placeholder="Type admin reply here...">${escapeHtml(item.reply || "")}</textarea>
          <input class="admin-reply-file" type="file" data-message-file="${escapeHtml(item.id || "")}" accept="image/*" />
        </td>
        <td>${escapeHtml(String(displayDate).replace("T"," ").slice(0,19) || "-")}
          <button class="btn dark admin-reply-save" style="width:100%;margin-top:8px" data-message-save="${escapeHtml(item.id || "")}">Save Reply</button>
        </td>
      </tr>`;
    }).join("");

    tbody.querySelectorAll("[data-message-status]").forEach(sel => {
      sel.onchange = async () => {
        try{
          await updateMessage(sel.dataset.messageStatus, { status: sel.value });
          showNotice("Message status updated");
        }catch{
          showNotice("Message status update failed");
        }
      };
    });

    tbody.querySelectorAll("[data-message-save]").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.messageSave;
        const box = tbody.querySelector(`[data-message-reply="${id}"]`);
        const fileInput = tbody.querySelector(`[data-message-file="${id}"]`);
        const reply = (box?.value || "").trim();
        const file = fileInput?.files?.[0] || null;
        try{
          let imageUrl = "";
          if(file) imageUrl = await uploadChatImage(file);
          await updateMessage(id, { reply, replyImage: imageUrl, status: (reply || imageUrl) ? "Replied" : "New" });
          showNotice("Reply saved");
        }catch(error){
          showNotice(error?.message || "Reply save failed");
        }
      };
    });
  }
    tbody.innerHTML = messages.map(item => {
      const displayDate = item.createdAt?.seconds
        ? new Date(item.createdAt.seconds * 1000).toLocaleString()
        : (item.createdAt || "-");
      return `
      <tr>
        <td>
          <div style="font-weight:800">${escapeHtml(item.name || "-")}</div>
          <div class="small">${escapeHtml(item.phone || "-")}</div>
        </td>
        <td style="min-width:260px">
          <div style="margin-bottom:8px">${escapeHtml(item.message || "-")}</div>
          ${item.image ? `<img class="chat-image" src="${item.image}" alt="Customer image" />` : ""}
        </td>
        <td>
          <select class="order-status-select" data-message-status="${escapeHtml(item.id || "")}">
            <option value="New" ${item.status === "New" ? "selected" : ""}>New</option>
            <option value="Replied" ${item.status === "Replied" ? "selected" : ""}>Replied</option>
          </select>
          <textarea class="admin-reply-box" data-message-reply="${escapeHtml(item.id || "")}" placeholder="Type admin reply here...">${escapeHtml(item.reply || "")}</textarea>
          <input class="admin-reply-file" type="file" data-message-file="${escapeHtml(item.id || "")}" accept="image/*" />
        </td>
        <td>${escapeHtml(String(displayDate).replace("T"," ").slice(0,19) || "-")}
          <button class="btn dark admin-reply-save" style="width:100%;margin-top:8px" data-message-save="${escapeHtml(item.id || "")}">Save Reply</button>
        </td>
      </tr>`;
    }).join("");

    tbody.querySelectorAll("[data-message-status]").forEach(sel => {
      sel.onchange = async () => {
        try{
          await updateMessage(sel.dataset.messageStatus, { status: sel.value });
          showNotice("Message status updated");
        }catch{
          showNotice("Message status update failed");
        }
      };
    });

    tbody.querySelectorAll("[data-message-save]").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.messageSave;
        const box = tbody.querySelector(`[data-message-reply="${id}"]`);
        const fileInput = tbody.querySelector(`[data-message-file="${id}"]`);
        const reply = (box?.value || "").trim();
        const file = fileInput?.files?.[0] || null;
        try{
          let imageUrl = "";
          if(file) imageUrl = await uploadChatImage(file);
          await updateMessage(id, { reply, replyImage: imageUrl, status: (reply || imageUrl) ? "Replied" : "New" });
          showNotice("Reply saved");
        }catch(error){
          showNotice(error?.message || "Reply save failed");
        }
      };
    });
  }


  function renderCustomers(customers){ const tbody = $("customersTable"); if(!tbody) return; if(!customers.length){ tbody.innerHTML = '<tr><td colspan="4" class="empty">No customers yet.</td></tr>'; return; } tbody.innerHTML = customers.map(customer => `<tr><td>${escapeHtml(customer.name||"-")}</td><td>${escapeHtml(customer.phone||"-")}</td><td>${escapeHtml(customer.email||"-")}</td><td>${escapeHtml(customer.address||"-")}</td></tr>`).join(""); }
  function switchTab(tabName){ document.querySelectorAll(".admin-tab-panel").forEach(panel => panel.classList.add("hidden")); const target = $("tab-"+tabName); if(target) target.classList.remove("hidden"); document.querySelectorAll(".admin-tab-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.tab===tabName)); }

  subscribeProducts((items, source) => renderProductsAdmin(items, source));
  subscribeOrders((activeOrders, historyOrders) => renderOrders(activeOrders, historyOrders));
  subscribeCustomers((customers) => renderCustomers(customers));
  subscribeMessages((messages) => renderMessages(messages));
  document.querySelectorAll(".admin-tab-btn").forEach(btn => btn.onclick = () => switchTab(btn.dataset.tab));
  switchTab("products");
  form.onsubmit = async (e) => { e.preventDefault(); const docId = $("docId").value.trim(); const payload = {
      name:$("name").value.trim(),
      brand:$("brand").value.trim(),
      category:$("category").value,
      price:Number($("price").value),
      oldPrice:Number($("oldPrice").value),
      stock:Number($("stock").value),
      sold:$("sold").value.trim() || "0 sold",
      badge:$("badge").value.trim() || "New",
      image:$("image").value.trim(),
      images:[
        $("image").value.trim(),
        $("image2") ? $("image2").value.trim() : "",
        $("image3") ? $("image3").value.trim() : "",
        $("image4") ? $("image4").value.trim() : ""
      ].filter(Boolean)
    }; try { await saveProduct(payload, docId || null); clearForm(); showNotice("Product saved"); } catch { showNotice("Save failed"); } };
  $("clearFormBtn").onclick = clearForm;
  $("seedBtn").onclick = async () => { try { await seedProducts(); showNotice("Demo products added"); } catch (error) { showNotice(error.message || "Seed failed"); } };
  $("resetBtn").onclick = () => { localStorage.removeItem(PRODUCTS_KEY); localStorage.removeItem(CART_KEY); localStorage.removeItem(ACCOUNT_KEY); localStorage.removeItem(CUSTOMERS_KEY); localStorage.removeItem(ORDERS_KEY); localStorage.removeItem(HISTORY_KEY); seedLocalIfEmpty(); showNotice("Local data reset"); };
  $("switchLocalBtn").onclick = () => { setMode("local"); showNotice("Switched to local mode"); setTimeout(() => location.reload(), 600); };
  $("switchFirebaseBtn").onclick = () => { if(!firebaseReady){ showNotice("Firebase is not available here"); return; } setMode("firebase"); showNotice("Switched to Firebase mode"); setTimeout(() => location.reload(), 600); };
}
