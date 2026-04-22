
import { db, firebaseReady } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, onSnapshot, updateDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

function $(id){ return document.getElementById(id); }
const storage = getStorage();
const CHAT_ID_KEY = "tee_shirt_firebase_chat_id";
const CUSTOMER_INFO_KEY = "tee_shirt_firebase_customer_info";

function showNotice(text){
  const el = $("notice");
  if(!el) return;
  el.textContent = text;
  el.style.display = "block";
  clearTimeout(window.__noticeTimer);
  window.__noticeTimer = setTimeout(() => el.style.display = "none", 2200);
}
function escapeHtml(value){
  return String(value)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}
function playNotificationBeep(){
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.03;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.12);
  }catch{}
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
  canvas.width = width; canvas.height = height;
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
async function preparePreviewURL(file){
  const blob = await compressImageFile(file);
  return URL.createObjectURL(blob);
}
async function uploadChatImage(file){
  if(!firebaseReady) throw new Error("Firebase is not ready.");
  const blob = await compressImageFile(file);
  const path = "chatImages/" + Date.now() + "_" + Math.random().toString(36).slice(2) + ".jpg";
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
  return await getDownloadURL(storageRef);
}
function setCustomerInfo(name, phone){
  localStorage.setItem(CUSTOMER_INFO_KEY, JSON.stringify({name, phone}));
}
function getCustomerInfo(){
  try{ return JSON.parse(localStorage.getItem(CUSTOMER_INFO_KEY) || "{}"); }catch{ return {}; }
}
function setCurrentChatId(id){ localStorage.setItem(CHAT_ID_KEY, id); }
function getCurrentChatId(){ return localStorage.getItem(CHAT_ID_KEY) || ""; }

function renderPreview(areaId, inputId, stateKey){
  const area = $(areaId);
  if(!area) return;
  const url = window[stateKey];
  if(!url){
    area.classList.add("hidden");
    area.innerHTML = "";
    return;
  }
  area.classList.remove("hidden");
  area.innerHTML = '<div class="image-preview-card"><img src="' + url + '" alt="Selected image"><button class="image-preview-remove" type="button" id="' + areaId + '_remove">✕</button></div>';
  const btn = $(areaId + "_remove");
  if(btn){
    btn.onclick = () => {
      window[stateKey] = "";
      const input = $(inputId);
      if(input) input.value = "";
      renderPreview(areaId, inputId, stateKey);
    };
  }
}
function threadHTML(thread, otherLabel, seenCustomer, seenAdmin, typingWho){
  if(!thread.length){
    return '<div class="chat-empty">No messages yet. Start the conversation.</div>';
  }
  let html = "";
  thread.forEach((item, idx) => {
    const who = item.sender === "admin" ? "admin" : "customer";
    const avatar = who === "admin" ? "🧑‍💼" : "🧑";
    const label = who === "admin" ? "Admin" : otherLabel;
    const isLast = idx === thread.length - 1;
    html += '<div class="chat-row ' + who + '"><div class="chat-avatar">' + avatar + '</div><div class="chat-bubble-wrap"><div class="chat-bubble">' +
      (item.text ? '<div>' + escapeHtml(item.text) + '</div>' : '') +
      (item.image ? '<img class="chat-image" src="' + item.image + '" alt="Chat image">' : '') +
      '<span class="chat-meta">' + label + ' • ' + escapeHtml(String(item.at || "").replace("T"," ").slice(0,16)) + '</span>' +
      ((who === "admin" && isLast && seenCustomer) ? '<span class="chat-status">Seen by customer</span>' : '') +
      ((who === "customer" && isLast && seenAdmin) ? '<span class="chat-status">Seen by admin</span>' : '') +
      '</div></div></div>';
  });
  if(typingWho === "admin"){
    html += '<div class="chat-row admin"><div class="chat-avatar">🧑‍💼</div><div class="chat-bubble-wrap"><div class="typing-pill">Admin is typing <span class="typing-dots"><span></span><span></span><span></span></span></div></div></div>';
  }
  if(typingWho === "customer"){
    html += '<div class="chat-row customer"><div class="chat-bubble-wrap"><div class="typing-pill">Customer is typing <span class="typing-dots"><span></span><span></span><span></span></span></div></div><div class="chat-avatar">🧑</div></div>';
  }
  return html;
}

let latestMessages = [];
let lastAdminCount = 0;

function updateInboxBadge(conversation){
  const badge = $("inboxBadge");
  if(!badge) return;
  if(conversation && conversation.unreadCustomer){
    badge.classList.remove("hidden");
    badge.textContent = "1";
  }else{
    badge.classList.add("hidden");
  }
}
async function findCustomerConversation(){
  const info = getCustomerInfo();
  const chatId = getCurrentChatId();
  if(chatId){
    const found = latestMessages.find(m => m.id === chatId);
    if(found) return found;
  }
  if(info.phone){
    const byPhone = latestMessages
      .filter(m => m.phone === info.phone)
      .sort((a,b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))[0];
    if(byPhone){
      setCurrentChatId(byPhone.id);
      return byPhone;
    }
  }
  return null;
}
async function markCustomerSeen(conversation){
  if(!conversation || !firebaseReady) return;
  try{
    await updateDoc(doc(db, "messages", conversation.id), {
      unreadCustomer:false,
      lastSeenByCustomer:new Date().toISOString()
    });
  }catch{}
}
async function markAdminSeen(conversation){
  if(!conversation || !firebaseReady) return;
  try{
    await updateDoc(doc(db, "messages", conversation.id), {
      unreadAdmin:false,
      lastSeenByAdmin:new Date().toISOString()
    });
  }catch{}
}
async function setTyping(conversationId, side, isTyping){
  if(!conversationId || !firebaseReady) return;
  try{
    await updateDoc(doc(db, "messages", conversationId), {
      [side === "admin" ? "adminTyping" : "customerTyping"]: !!isTyping
    });
  }catch{}
}

function renderCustomerChat(){
  const box = $("customerChatWindow");
  if(!box) return;
  const convo = latestMessages.find(m => m.id === getCurrentChatId()) || null;
  if(!convo){
    box.innerHTML = '<div class="chat-empty">Start your custom bulk order chat here.</div>';
    updateInboxBadge(null);
    return;
  }
  box.innerHTML = threadHTML(convo.thread || [], "You", convo.lastSeenByCustomer, convo.lastSeenByAdmin, convo.adminTyping ? "admin" : "");
  box.scrollTop = box.scrollHeight;
  updateInboxBadge(convo);
}
function renderAdminConversationList(){
  const list = $("messagesList");
  if(!list) return;
  if(!latestMessages.length){
    list.innerHTML = '<div class="chat-empty">No conversations yet.</div>';
    return;
  }
  const selected = getCurrentChatId();
  list.innerHTML = latestMessages.map(item => {
    const preview = item.latestMessage || item.message || "";
    return '<div class="admin-conversation-item ' + (item.id === selected ? 'active ' : '') + (item.unreadAdmin ? 'unread' : '') + '" data-open-message="' + escapeHtml(item.id) + '"><div class="admin-conversation-name">' + escapeHtml(item.name || "-") + (item.unreadAdmin ? '<span class="unread-badge">NEW</span>' : '') + '</div><div class="small">' + escapeHtml(item.phone || "-") + '</div><div class="admin-conversation-preview">' + escapeHtml(preview || "Image") + '</div></div>';
  }).join("");
  list.querySelectorAll("[data-open-message]").forEach(el => {
    el.onclick = async () => {
      setCurrentChatId(el.dataset.openMessage);
      const convo = latestMessages.find(m => m.id === el.dataset.openMessage);
      await markAdminSeen(convo);
      renderAdminChat();
      renderAdminConversationList();
    };
  });
}
function renderAdminChat(){
  const header = $("adminConversationHeader");
  const box = $("adminChatWindow");
  const typing = $("typingStatus");
  const statusSel = $("adminMessageStatus");
  if(!box || !header) return;
  const convo = latestMessages.find(m => m.id === getCurrentChatId()) || null;
  if(!convo){
    header.textContent = "Select a conversation";
    if(typing) typing.textContent = "No one is typing";
    box.innerHTML = '<div class="chat-empty">No conversation selected.</div>';
    return;
  }
  header.textContent = (convo.name || "-") + " • " + (convo.phone || "-");
  if(typing) typing.textContent = convo.customerTyping ? "Customer is typing..." : "No one is typing";
  if(statusSel) statusSel.value = convo.status || "New";
  box.innerHTML = threadHTML(convo.thread || [], convo.name || "Customer", convo.lastSeenByCustomer, convo.lastSeenByAdmin, convo.customerTyping ? "customer" : "");
  box.scrollTop = box.scrollHeight;
}

async function sendCustomerMessage(){
  const name = ($("inq_name")?.value || "").trim();
  const phone = ($("inq_phone")?.value || "").trim();
  const text = ($("inq_message")?.value || "").trim();
  const file = $("customerImageInput")?.files?.[0] || null;
  if(!name || !phone || (!text && !file)){
    showNotice("Type a message or choose an image");
    return;
  }
  if(!firebaseReady){
    showNotice("Firebase is not ready");
    return;
  }
  try{
    setCustomerInfo(name, phone);
    let convo = await findCustomerConversation();
    let imageUrl = "";
    if(file) imageUrl = await uploadChatImage(file);
    const now = new Date().toISOString();

    if(convo){
      const thread = Array.isArray(convo.thread) ? convo.thread.slice() : [];
      thread.push({ sender:"customer", text, image:imageUrl, at:now });
      await updateDoc(doc(db, "messages", convo.id), {
        name, phone,
        thread,
        latestMessage: text || "Image",
        message: text || convo.message || "",
        unreadAdmin:true,
        unreadCustomer:false,
        customerTyping:false,
        status:"New",
        updatedAt: now
      });
    }else{
      const refDoc = await addDoc(collection(db, "messages"), {
        name, phone,
        message: text || "",
        latestMessage: text || "Image",
        reply:"",
        thread:[{ sender:"customer", text, image:imageUrl, at:now }],
        unreadAdmin:true,
        unreadCustomer:false,
        customerTyping:false,
        adminTyping:false,
        lastSeenByCustomer:"",
        lastSeenByAdmin:"",
        status:"New",
        createdAt: now,
        updatedAt: now
      });
      setCurrentChatId(refDoc.id);
    }

    $("inq_message").value = "";
    if($("customerImageInput")) $("customerImageInput").value = "";
    window.__customerPreview = "";
    renderPreview("customerPreviewArea","customerImageInput","__customerPreview");
    showNotice("Message sent");
  }catch(err){
    showNotice(err?.message || "Failed to send message");
  }
}
async function sendAdminMessage(){
  const convo = latestMessages.find(m => m.id === getCurrentChatId()) || null;
  const text = ($("adminReplyText")?.value || "").trim();
  const file = $("adminImageInput")?.files?.[0] || null;
  if(!convo){
    showNotice("Select a conversation first");
    return;
  }
  if(!text && !file){
    showNotice("Type a reply or choose an image");
    return;
  }
  try{
    let imageUrl = "";
    if(file) imageUrl = await uploadChatImage(file);
    const now = new Date().toISOString();
    const thread = Array.isArray(convo.thread) ? convo.thread.slice() : [];
    thread.push({ sender:"admin", text, image:imageUrl, at:now });
    await updateDoc(doc(db, "messages", convo.id), {
      thread,
      latestMessage: text || "Image",
      reply: text || convo.reply || "",
      unreadCustomer:true,
      unreadAdmin:false,
      adminTyping:false,
      status:"Replied",
      updatedAt: now
    });
    $("adminReplyText").value = "";
    if($("adminImageInput")) $("adminImageInput").value = "";
    window.__adminPreview = "";
    renderPreview("adminPreviewArea","adminImageInput","__adminPreview");
    showNotice("Reply sent");
  }catch(err){
    showNotice(err?.message || "Reply failed");
  }
}

function subscribeRealtime(){
  if(!firebaseReady) return;
  onSnapshot(collection(db, "messages"), (snapshot) => {
    latestMessages = snapshot.docs.map(d => ({ id:d.id, ...d.data() }))
      .sort((a,b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));

    if(document.body.dataset.page === "admin"){
      if(latestMessages.length > lastAdminCount && lastAdminCount !== 0) playNotificationBeep();
      lastAdminCount = latestMessages.length;
      renderAdminConversationList();
      renderAdminChat();
    }else{
      findCustomerConversation().then(async convo => {
        if(convo){
          setCurrentChatId(convo.id);
          renderCustomerChat();
          if(convo.unreadCustomer) await markCustomerSeen(convo);
        }else{
          renderCustomerChat();
        }
      });
    }
  });
}

function initShop(){
  const info = getCustomerInfo();
  if($("inq_name")) $("inq_name").value = info.name || "";
  if($("inq_phone")) $("inq_phone").value = info.phone || "";
  if($("openInboxBtn")) $("openInboxBtn").onclick = () => {
    $("inquiryModal")?.classList.remove("hidden");
    renderCustomerChat();
  };
  if($("openAccountBtn")) $("openAccountBtn").onclick = () => {
    $("inquiryModal")?.classList.remove("hidden");
    renderCustomerChat();
  };
  if($("closeInquiryBtn")) $("closeInquiryBtn").onclick = () => $("inquiryModal")?.classList.add("hidden");
  if($("inquiryModal")) $("inquiryModal").onclick = (e) => { if(e.target.id === "inquiryModal") $("inquiryModal").classList.add("hidden"); };
  if($("sendInquiryBtn")) $("sendInquiryBtn").onclick = sendCustomerMessage;
  if($("customerImageInput")) $("customerImageInput").onchange = async () => {
    const file = $("customerImageInput").files?.[0];
    if(!file){ window.__customerPreview = ""; renderPreview("customerPreviewArea","customerImageInput","__customerPreview"); return; }
    try{
      window.__customerPreview = await preparePreviewURL(file);
      renderPreview("customerPreviewArea","customerImageInput","__customerPreview");
    }catch(err){ showNotice(err?.message || "Preview failed"); }
  };
  if($("inq_message")) $("inq_message").oninput = async () => {
    const convo = await findCustomerConversation();
    await setTyping(convo?.id, "customer", !!$("inq_message").value.trim());
  };
  renderCustomerChat();
}
function initAdmin(){
  if($("sendAdminReplyBtn")) $("sendAdminReplyBtn").onclick = sendAdminMessage;
  if($("adminImageInput")) $("adminImageInput").onchange = async () => {
    const file = $("adminImageInput").files?.[0];
    if(!file){ window.__adminPreview = ""; renderPreview("adminPreviewArea","adminImageInput","__adminPreview"); return; }
    try{
      window.__adminPreview = await preparePreviewURL(file);
      renderPreview("adminPreviewArea","adminImageInput","__adminPreview");
    }catch(err){ showNotice(err?.message || "Preview failed"); }
  };
  if($("adminReplyText")) $("adminReplyText").oninput = async () => {
    const convo = latestMessages.find(m => m.id === getCurrentChatId()) || null;
    await setTyping(convo?.id, "admin", !!$("adminReplyText").value.trim());
  };
  if($("adminMessageStatus")) $("adminMessageStatus").onchange = async () => {
    const convo = latestMessages.find(m => m.id === getCurrentChatId()) || null;
    if(!convo) return;
    try{
      await updateDoc(doc(db, "messages", convo.id), { status: $("adminMessageStatus").value });
      showNotice("Status updated");
    }catch{ showNotice("Status update failed"); }
  };
  renderAdminConversationList();
  renderAdminChat();
}

document.addEventListener("DOMContentLoaded", () => {
  subscribeRealtime();
  if(document.body.dataset.page === "shop") initShop();
  if(document.body.dataset.page === "admin") initAdmin();
});
