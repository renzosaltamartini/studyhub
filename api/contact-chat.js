import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import nodemailer from "nodemailer";

const ADMIN_APP_NAME = "studyhub-contact-chat";
const STAFF_EMAILS = new Set([
  "renzosaltamartini2008@gmail.com",
  "studyhubyrenzo@gmail.com"
]);

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function adminServices() {
  let adminApp = getApps().find((item) => item.name === ADMIN_APP_NAME);
  if (!adminApp) {
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const databaseURL = process.env.FIREBASE_DATABASE_URL;
    if (!privateKey || !projectId || !clientEmail || !databaseURL) {
      throw new HttpError(500, "Faltan variables de Firebase Admin en Vercel.");
    }
    adminApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      databaseURL
    }, ADMIN_APP_NAME);
  }
  return { auth: getAuth(adminApp), database: getDatabase(adminApp) };
}

async function authenticatedUser(req) {
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) throw new HttpError(401, "Debes iniciar sesión.");
  const { auth } = adminServices();
  const decoded = await auth.verifyIdToken(authorization.slice(7));
  if (!decoded.email) throw new HttpError(400, "La cuenta no tiene un correo disponible.");
  decoded.email = decoded.email.toLowerCase();
  return decoded;
}

function cleanText(value, maxLength) {
  return String(value || "").trim().replace(/\r\n/g, "\n").slice(0, maxLength);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

async function notifySupport({ chatId, user, subject, message }) {
  const gmailUser = (process.env.GMAIL_USER || "").trim();
  const gmailPassword = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, "");
  const fromName = (process.env.EMAIL_FROM_NAME || "StudyHub").trim();
  if (!gmailUser || !gmailPassword) throw new HttpError(500, "Configura GMAIL_USER y GMAIL_APP_PASSWORD en Vercel.");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPassword },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000
  });
  const chatURL = `https://stdyhub.vercel.app/contacto/chat/${chatId}`;
  await transporter.sendMail({
    from: { name: fromName || "StudyHub", address: gmailUser },
    to: gmailUser,
    subject: `Nuevo contacto #${chatId}: ${subject}`,
    text: `${user.name || "Usuario"} (${user.email}) abrió el chat #${chatId}.\n\n${message}\n\n${chatURL}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#202124"><h2>Nuevo contacto #${chatId}</h2><p><strong>${escapeHTML(user.name || "Usuario")}</strong><br>${escapeHTML(user.email)}</p><p><strong>${escapeHTML(subject)}</strong></p><div style="padding:16px;border-radius:12px;background:#f1f3f4;white-space:pre-wrap">${escapeHTML(message)}</div><p style="margin-top:24px"><a href="${chatURL}">Abrir conversación</a></p></div>`
  });
}

async function nextChatId(database) {
  const result = await database.ref("contactChatCounter").transaction((value) => Number(value || 0) + 1);
  if (!result.committed) throw new HttpError(500, "No se pudo generar el número del chat.");
  return String(result.snapshot.val()).padStart(6, "0");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json({ ok: true, service: "contact-chat" });
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });
  try {
    const user = await authenticatedUser(req);
    const { database } = adminServices();
    const action = req.body?.action;
    const uid = user.uid;
    const userChatRef = database.ref(`userChats/${uid}`);

    if (action === "status") {
      const mapping = (await userChatRef.get()).val();
      if (!mapping?.chatId) return res.status(200).json({ hasChat: false, isStaff: STAFF_EMAILS.has(user.email) });
      const chat = (await database.ref(`contactChats/${mapping.chatId}`).get()).val();
      return res.status(200).json({
        hasChat: Boolean(chat),
        chatId: mapping.chatId,
        status: chat?.status || null,
        unread: Boolean(chat?.unreadByUser),
        isStaff: STAFF_EMAILS.has(user.email)
      });
    }

    if (action === "create") {
      const subject = cleanText(req.body?.subject, 90);
      const message = cleanText(req.body?.message, 2000);
      if (subject.length < 3) throw new HttpError(400, "Escribe un asunto de al menos 3 caracteres.");
      if (message.length < 10) throw new HttpError(400, "El mensaje debe tener al menos 10 caracteres.");
      const now = Date.now();
      const existingMapping = (await userChatRef.get()).val();
      let chatId = existingMapping?.chatId;
      let isNewChat = false;
      if (chatId) {
        const chatRef = database.ref(`contactChats/${chatId}`);
        const chat = (await chatRef.get()).val();
        if (chat?.ownerUid === uid) {
          const messageRef = chatRef.child("messages").push();
          await messageRef.set({ senderUid: uid, senderEmail: user.email, senderName: user.name || "Usuario", senderRole: "user", text: message, createdAt: now });
          await chatRef.update({ subject, status: "open", updatedAt: now, lastMessageAt: now, lastMessageText: message.slice(0, 140), unreadByStaff: true, unreadByUser: false });
        } else {
          chatId = null;
        }
      }
      if (!chatId) {
        chatId = await nextChatId(database);
        isNewChat = true;
        const chatRef = database.ref(`contactChats/${chatId}`);
        const messageId = chatRef.child("messages").push().key;
        await database.ref().update({
          [`contactChats/${chatId}`]: {
            chatId,
            ownerUid: uid,
            ownerEmail: user.email,
            ownerName: user.name || "Usuario",
            subject,
            status: "open",
            createdAt: now,
            updatedAt: now,
            lastMessageAt: now,
            lastMessageText: message.slice(0, 140),
            unreadByStaff: true,
            unreadByUser: false,
            messages: {
              [messageId]: { senderUid: uid, senderEmail: user.email, senderName: user.name || "Usuario", senderRole: "user", text: message, createdAt: now }
            }
          },
          [`userChats/${uid}`]: { chatId, createdAt: now }
        });
      }
      let notificationSent = true;
      try {
        await notifySupport({ chatId, user, subject, message });
      } catch (error) {
        notificationSent = false;
        console.error("Contact notification:", error?.message || error);
      }
      return res.status(200).json({ chatId, isNewChat, notificationSent, url: `/contacto/chat/${chatId}` });
    }

    throw new HttpError(400, "Acción desconocida.");
  } catch (error) {
    console.error("Contact chat:", error);
    return res.status(error instanceof HttpError ? error.status : 500).json({ error: error.message || "No se pudo crear el contacto.", ...(error.extra || {}) });
  }
}
