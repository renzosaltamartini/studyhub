import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getDatabase, ref, get, onValue, push, set, update } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";
import { firebaseConfig } from "/firebase-config.js";

const STAFF_EMAILS = new Set(["renzosaltamartini2008@gmail.com", "studyhubyrenzo@gmail.com"]);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const $ = (id) => document.getElementById(id);
const pathParts = window.location.pathname.split("/").filter(Boolean);
const chatId = pathParts.length > 2 ? pathParts[2] : null;
let currentUser = null;
let currentChat = null;
let staff = false;
let inboxChats = [];
let activeFilter = "all";

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
    bubble.append(author, text, time);
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
    $("statusButton").classList.toggle("hidden", !staff);
    $("statusButton").textContent = chat.status === "closed" ? "Reabrir chat" : "Cerrar chat";
    $("messageInput").disabled = chat.status === "closed" && !staff;
    $("sendMessageButton").disabled = chat.status === "closed" && !staff;
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
  if (!text || !currentChat) return;
  const button = $("sendMessageButton");
  button.disabled = true;
  $("chatError").classList.add("hidden");
  try {
    const now = Date.now();
    const messageRef = push(ref(database, `contactChats/${chatId}/messages`));
    await set(messageRef, { senderUid: currentUser.uid, senderEmail: currentUser.email || "", senderName: currentUser.displayName || "Usuario", senderRole: staff ? "staff" : "user", text, createdAt: now });
    await update(ref(database, `contactChats/${chatId}`), { status: "open", updatedAt: now, lastMessageAt: now, lastMessageText: text.slice(0, 140), unreadByStaff: !staff, unreadByUser: staff });
    input.value = "";
  } catch (error) {
    $("chatError").textContent = "No se pudo enviar el mensaje. Revisa las reglas de Firebase.";
    $("chatError").classList.remove("hidden");
  } finally {
    button.disabled = false;
  }
});

$("statusButton").addEventListener("click", async () => {
  if (!staff || !currentChat) return;
  await update(ref(database, `contactChats/${chatId}`), { status: currentChat.status === "closed" ? "open" : "closed", updatedAt: Date.now() });
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
