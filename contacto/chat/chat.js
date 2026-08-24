import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getDatabase, ref, get, onValue, push, set, update } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { firebaseConfig } from "/firebase-config.js";
import { supabaseConfig } from "/supabase-config.js";

const STAFF_EMAILS = new Set(["renzosaltamartini2008@gmail.com", "studyhubyrenzo@gmail.com"]);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const $ = (id) => document.getElementById(id);
const pathParts = window.location.pathname.split("/").filter(Boolean);
const chatId = pathParts.length > 2 ? pathParts[2] : null;
let currentUser = null;
let currentChat = null;
let staff = false;
let inboxChats = [];
let activeFilter = "all";
let pendingFile = null;
let pendingPreviewURL = null;
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;
const FILE_TYPES = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", csv: "text/csv", zip: "application/zip", rar: "application/x-rar-compressed"
};

function showOnly(id) {
  ["loadingView", "deniedView", "inboxView", "conversationView"].forEach((view) => $(view).classList.toggle("hidden", view !== id));
}

function deny(message) {
  $("deniedMessage").textContent = message;
  showOnly("deniedView");
}

function formatDate(value, detailed = false) {
  if (!value) return "Ahora";
  return new Intl.DateTimeFormat("es-AR", detailed ? { dateStyle: "short", timeStyle: "short" } : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(Number(value)));
}

function initials(name) {
  return String(name || "U").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatSize(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function fileType(file) {
  const extension = String(file?.name || "").split(".").pop().toLowerCase();
  return FILE_TYPES[extension] || null;
}

function safeFileName(name) {
  return String(name || "archivo").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "archivo";
}

async function storageAPI(action, payload = {}) {
  const token = await currentUser.getIdToken();
  const response = await fetch("/api/files", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, ...payload }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo acceder al adjunto.");
  return data;
}

async function contactAPI(action, payload = {}) {
  const token = await currentUser.getIdToken();
  const response = await fetch("/api/contact-chat", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, ...payload }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo completar la acción.");
  return data;
}

function clearPendingAttachment() {
  pendingFile = null;
  if (pendingPreviewURL) URL.revokeObjectURL(pendingPreviewURL);
  pendingPreviewURL = null;
  $("attachmentInput").value = "";
  $("pendingAttachment").classList.add("hidden");
  $("pendingAttachmentIcon").innerHTML = '<i class="fa-regular fa-file"></i>';
}

function selectAttachment(file) {
  const contentType = fileType(file);
  if (!contentType) throw new Error("Ese tipo de archivo no está permitido.");
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_SIZE) throw new Error("El archivo debe pesar como máximo 25 MB.");
  clearPendingAttachment();
  pendingFile = { file, contentType };
  $("pendingAttachmentName").textContent = file.name;
  $("pendingAttachmentSize").textContent = `${formatSize(file.size)} · listo para enviar`;
  if (contentType.startsWith("image/")) {
    pendingPreviewURL = URL.createObjectURL(file);
    const image = document.createElement("img");
    image.src = pendingPreviewURL;
    image.alt = "Vista previa";
    $("pendingAttachmentIcon").replaceChildren(image);
  }
  $("pendingAttachment").classList.remove("hidden");
}

async function uploadAttachment() {
  if (!pendingFile) return null;
  const { file, contentType } = pendingFile;
  const path = `${currentUser.uid}/chat/${chatId}/${Date.now()}-${safeFileName(file.name)}`;
  const signed = await storageAPI("create-upload", { path, contentType, size: file.size });
  const result = await supabase.storage.from(supabaseConfig.bucket).uploadToSignedUrl(signed.path, signed.token, file, { contentType, cacheControl: "3600" });
  if (result.error) throw result.error;
  return { attachmentPath: path, attachmentName: file.name.slice(0, 160), attachmentType: contentType, attachmentSize: file.size, attachmentKind: contentType.startsWith("image/") ? "image" : "file" };
}

async function appendAttachment(message, bubble) {
  if (!message.attachmentPath) return;
  const loading = document.createElement("span");
  loading.className = "attachment-loading";
  loading.textContent = "Cargando adjunto...";
  bubble.appendChild(loading);
  try {
    const data = await storageAPI("signed-url", { path: message.attachmentPath, chatId, download: message.attachmentKind === "file" ? message.attachmentName : false });
    loading.remove();
    if (message.attachmentKind === "image") {
      const link = document.createElement("a");
      link.className = "chat-attachment";
      link.href = data.url;
      link.target = "_blank";
      link.rel = "noopener";
      const image = document.createElement("img");
      image.className = "chat-attachment-image";
      image.src = data.url;
      image.alt = message.attachmentName || "Imagen adjunta";
      link.appendChild(image);
      loading.replaceWith(link);
    } else {
      const link = document.createElement("a");
      link.className = "chat-attachment chat-attachment-file";
      link.href = data.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.innerHTML = '<i class="fa-regular fa-file-lines"></i>';
      const copy = document.createElement("span");
      const name = document.createElement("strong");
      name.textContent = message.attachmentName || "Archivo adjunto";
      const size = document.createElement("small");
      size.textContent = `${formatSize(message.attachmentSize)} · Descargar`;
      copy.append(name, size);
      link.appendChild(copy);
      loading.replaceWith(link);
    }
  } catch (error) {
    loading.textContent = "No se pudo cargar el adjunto";
  }
}

function renderInbox() {
  const list = $("chatList");
  list.innerHTML = "";
  const filtered = inboxChats.filter((chat) => activeFilter === "all" || (activeFilter === "unread" ? chat.unreadByStaff : chat.status === activeFilter));
  $("openChatCount").textContent = inboxChats.filter((chat) => chat.status === "open").length;
  $("emptyInbox").classList.toggle("hidden", filtered.length > 0);
  filtered.forEach((chat) => {
    const link = document.createElement("a");
    link.className = "chat-list-item";
    link.href = `/contacto/chat/${chat.chatId}`;
    const avatar = document.createElement("span");
    avatar.className = "chat-list-avatar";
    avatar.textContent = initials(chat.ownerName);
    const content = document.createElement("div");
    content.className = "chat-list-content";
    const line = document.createElement("div");
    line.className = "chat-list-line";
    const title = document.createElement("strong");
    title.textContent = `#${chat.chatId} · ${chat.subject || "Sin asunto"}`;
    line.appendChild(title);
    if (chat.unreadByStaff) { const dot = document.createElement("span"); dot.className = "unread-dot"; line.appendChild(dot); }
    const preview = document.createElement("p");
    preview.textContent = `${chat.ownerName || "Usuario"} · ${chat.lastMessageText || "Sin mensajes"}`;
    content.append(line, preview);
    const meta = document.createElement("div");
    meta.className = "chat-list-meta";
    const time = document.createElement("time");
    time.textContent = formatDate(chat.lastMessageAt || chat.updatedAt);
    const status = document.createElement("span");
    status.className = `status-pill ${chat.status === "closed" ? "closed" : ""}`;
    status.textContent = chat.status === "closed" ? "Cerrado" : "Abierto";
    meta.append(time, status);
    link.append(avatar, content, meta);
    list.appendChild(link);
  });
}

function openInbox() {
  if (!staff) return deny("Esta bandeja está disponible únicamente para las cuentas de soporte autorizadas.");
  showOnly("inboxView");
  onValue(ref(database, "contactChats"), (snapshot) => {
    const data = snapshot.val() || {};
    inboxChats = Object.entries(data).map(([id, chat]) => ({ ...chat, chatId: chat.chatId || id })).sort((a, b) => Number(b.lastMessageAt || b.updatedAt || 0) - Number(a.lastMessageAt || a.updatedAt || 0));
    renderInbox();
  }, () => deny("No pudimos cargar los chats. Comprueba que publicaste las reglas nuevas de Firebase."));
}

function renderMessages(chat) {
  const container = $("messages");
  container.innerHTML = "";
  const messages = Object.entries(chat.messages || {}).map(([id, value]) => ({ id, ...value })).sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  messages.forEach((message) => {
    const row = document.createElement("div");
    const mine = message.senderUid === currentUser.uid;
    row.className = `message-row ${mine ? "mine" : ""}`;
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    const author = document.createElement("span");
    author.className = "message-author";
    author.textContent = message.senderRole === "staff" ? `Soporte · ${message.senderName || "StudyHub"}` : message.senderName || "Usuario";
    const text = document.createElement("p");
    text.className = "message-text";
    text.textContent = message.text || "";
    const time = document.createElement("time");
    time.className = "message-time";
    time.textContent = formatDate(message.createdAt, true);
    bubble.append(author, text);
    appendAttachment(message, bubble);
    bubble.append(time);
    row.appendChild(bubble);
    container.appendChild(row);
  });
  requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
}

function openConversation() {
  const chatRef = ref(database, `contactChats/${chatId}`);
  onValue(chatRef, async (snapshot) => {
    const chat = snapshot.val();
    if (!chat) return deny("El chat solicitado no existe o no tienes permiso para verlo.");
    if (!staff && chat.ownerUid !== currentUser.uid) return deny("No tienes permiso para acceder a la conversación de otro usuario.");
    currentChat = chat;
    $("conversationNumber").textContent = `Chat #${chatId}`;
    $("conversationSubject").textContent = chat.subject || "Conversación";
    $("conversationPerson").textContent = staff ? `${chat.ownerName || "Usuario"} · ${chat.ownerEmail || ""}` : "Soporte de StudyHub";
    $("backToInbox").classList.toggle("hidden", !staff);
    $("conversationActions").classList.toggle("hidden", !staff);
    $("statusButton").textContent = chat.status === "closed" ? "Reabrir chat" : "Cerrar chat";
    $("messageInput").disabled = chat.status === "closed" && !staff;
    $("sendMessageButton").disabled = chat.status === "closed" && !staff;
    $("attachButton").disabled = chat.status === "closed" && !staff;
    $("messageInput").placeholder = chat.status === "closed" && !staff ? "El soporte cerró esta conversación" : "Escribe un mensaje...";
    renderMessages(chat);
    showOnly("conversationView");
    const unreadField = staff ? "unreadByStaff" : "unreadByUser";
    if (chat[unreadField]) update(chatRef, { [unreadField]: false }).catch(() => {});
  }, () => deny("No puedes acceder a este chat."));
}

$("messageForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = $("messageInput");
  const text = input.value.trim();
  if ((!text && !pendingFile) || !currentChat) return;
  const button = $("sendMessageButton");
  button.disabled = true;
  $("chatError").classList.add("hidden");
  try {
    const now = Date.now();
    $("pendingAttachmentSize").textContent = pendingFile ? "Subiendo..." : "";
    const attachment = await uploadAttachment();
    const messageRef = push(ref(database, `contactChats/${chatId}/messages`));
    const finalText = text || (attachment?.attachmentKind === "image" ? "Imagen adjunta" : "Archivo adjunto");
    try {
      await set(messageRef, { senderUid: currentUser.uid, senderEmail: currentUser.email || "", senderName: currentUser.displayName || "Usuario", senderRole: staff ? "staff" : "user", text: finalText, createdAt: now, ...(attachment || {}) });
    } catch (error) {
      if (attachment?.attachmentPath) await storageAPI("delete", { path: attachment.attachmentPath }).catch(() => {});
      throw error;
    }
    await update(ref(database, `contactChats/${chatId}`), { status: "open", updatedAt: now, lastMessageAt: now, lastMessageText: attachment ? `Adjunto: ${attachment.attachmentName}`.slice(0, 140) : finalText.slice(0, 140), unreadByStaff: !staff, unreadByUser: staff });
    input.value = "";
    clearPendingAttachment();
  } catch (error) {
    $("chatError").textContent = error.message || "No se pudo enviar el mensaje.";
    $("chatError").classList.remove("hidden");
    if (pendingFile) $("pendingAttachmentSize").textContent = `${formatSize(pendingFile.file.size)} · intenta nuevamente`;
  } finally {
    button.disabled = false;
  }
});

$("attachButton").addEventListener("click", () => $("attachmentInput").click());
$("attachmentInput").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try { selectAttachment(file); }
  catch (error) { clearPendingAttachment(); $("chatError").textContent = error.message; $("chatError").classList.remove("hidden"); }
});
$("removePendingAttachment").addEventListener("click", clearPendingAttachment);

$("statusButton").addEventListener("click", async () => {
  if (!staff || !currentChat) return;
  await update(ref(database, `contactChats/${chatId}`), { status: currentChat.status === "closed" ? "open" : "closed", updatedAt: Date.now() });
});

$("deleteChatButton").addEventListener("click", async () => {
  if (!staff || !currentChat) return;
  const confirmed = window.confirm(`¿Eliminar para siempre el chat #${chatId}? También se borrarán todos sus mensajes y archivos. Esta acción no se puede deshacer.`);
  if (!confirmed) return;
  const button = $("deleteChatButton");
  button.disabled = true;
  try {
    await contactAPI("delete", { chatId });
    window.location.replace("/contacto/chat");
  } catch (error) {
    $("chatError").textContent = error.message || "No se pudo eliminar el chat.";
    $("chatError").classList.remove("hidden");
    button.disabled = false;
  }
});

document.querySelectorAll(".filter-button").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".filter-button").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  activeFilter = button.dataset.filter;
  renderInbox();
}));

onAuthStateChanged(auth, async (user) => {
  if (!user) return deny("Debes iniciar sesión para acceder a los chats de contacto.");
  currentUser = user;
  staff = STAFF_EMAILS.has((user.email || "").toLowerCase());
  $("chatAccountEmail").textContent = user.email || "Cuenta de Google";
  $("chatAccount").classList.remove("hidden");
  if (chatId) openConversation();
  else openInbox();
});
