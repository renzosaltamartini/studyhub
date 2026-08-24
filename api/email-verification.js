import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

const COOLDOWN_MS = 30_000;
const CODE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const ADMIN_APP_NAME = "studyhub-email-verification";

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

function codeHash(uid, code) {
  const configuredSecret = (process.env.EMAIL_CODE_SECRET || "").trim();
  const firebasePrivateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const secret = configuredSecret.length >= 16
    ? configuredSecret
    : createHash("sha256").update(`studyhub-email-code-v1:${firebasePrivateKey}`).digest("hex");
  if (!firebasePrivateKey && configuredSecret.length < 16) {
    throw new HttpError(500, "No hay una clave privada disponible para proteger los códigos.");
  }
  return createHash("sha256").update(`${uid}:${code}:${secret}`).digest("hex");
}

function sameHash(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

async function authenticatedUser(req) {
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) throw new HttpError(401, "Debes iniciar sesión nuevamente.");
  const { auth } = adminServices();
  const decoded = await auth.verifyIdToken(authorization.slice(7));
  if (!decoded.email) throw new HttpError(400, "La cuenta no tiene un correo disponible.");
  return decoded;
}

async function sendEmail({ email, name, code, requestId }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new HttpError(500, "Faltan las variables de correo en Vercel.");
  const safeName = escapeHTML(name || "estudiante");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `studyhub-${requestId}`
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `${code} es tu código de StudyHub`,
      text: `Hola ${name || "estudiante"}. Tu código de verificación es ${code}. Vence en 10 minutos.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px;color:#202124"><p>Hola ${safeName},</p><h1 style="font-size:22px">Verifica tu correo</h1><p style="color:#5f6368">Usa este código para terminar tu primer ingreso a StudyHub:</p><div style="margin:24px 0;padding:18px;border-radius:12px;background:#f1f3f4;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px">${code}</div><p style="color:#777;font-size:13px">El código vence en 10 minutos. Si no solicitaste este mensaje, puedes ignorarlo.</p></div>`
    })
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new HttpError(502, body.message || "No se pudo enviar el correo de verificación.");
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });
  try {
    const decoded = await authenticatedUser(req);
    const { database } = adminServices();
    const action = req.body?.action;
    const uid = decoded.uid;
    const email = decoded.email.toLowerCase();
    const profileRef = database.ref(`users/${uid}/profile`);
    const challengeRef = database.ref(`emailVerifications/${uid}`);

    if (action === "status") {
      const [profileSnapshot, challengeSnapshot] = await Promise.all([profileRef.get(), challengeRef.get()]);
      const profile = profileSnapshot.val() || {};
      const challenge = challengeSnapshot.val() || {};
      const now = Date.now();
      const verified = profile.emailVerified === true && profile.emailVerifiedAddress === email;
      return res.status(200).json({
        verified,
        email,
        hasActiveCode: !verified && Number(challenge.expiresAt || 0) > now,
        nextSendAt: Number(challenge.nextSendAt || 0),
        retryAfter: Math.max(0, Math.ceil((Number(challenge.nextSendAt || 0) - now) / 1000))
      });
    }

    if (action === "send") {
      const profile = (await profileRef.get()).val() || {};
      if (!profile.completed) throw new HttpError(403, "Primero debes completar tu perfil.");
      if (profile.emailVerified === true && profile.emailVerifiedAddress === email) {
        return res.status(200).json({ verified: true, email });
      }
      const now = Date.now();
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const requestId = randomUUID();
      const nextSendAt = now + COOLDOWN_MS;
      const expiresAt = now + CODE_TTL_MS;
      const transaction = await challengeRef.transaction((current) => {
        if (Number(current?.nextSendAt || 0) > now) return;
        return { requestId, email, codeHash: codeHash(uid, code), attempts: 0, createdAt: now, expiresAt, nextSendAt };
      }, undefined, false);
      if (!transaction.committed) {
        const current = transaction.snapshot.val() || {};
        const retryAfter = Math.max(1, Math.ceil((Number(current.nextSendAt || now) - now) / 1000));
        throw new HttpError(429, `Espera ${retryAfter} segundos para reenviar el código.`, { retryAfter, nextSendAt: Number(current.nextSendAt || 0) });
      }
      try {
        await sendEmail({ email, name: decoded.name, code, requestId });
      } catch (error) {
        await challengeRef.transaction((current) => current?.requestId === requestId ? null : current, undefined, false);
        throw error;
      }
      return res.status(200).json({ sent: true, email, expiresAt, nextSendAt, retryAfter: 30 });
    }

    if (action === "verify") {
      const code = String(req.body?.code || "").trim();
      if (!/^\d{6}$/.test(code)) throw new HttpError(400, "Ingresa los seis números del código.");
      const snapshot = await challengeRef.get();
      const challenge = snapshot.val();
      const now = Date.now();
      if (!challenge || challenge.email !== email) throw new HttpError(400, "Solicita un código nuevo.");
      if (Number(challenge.expiresAt || 0) <= now) throw new HttpError(400, "El código venció. Solicita uno nuevo.");
      if (Number(challenge.attempts || 0) >= MAX_ATTEMPTS) throw new HttpError(429, "Alcanzaste el límite de intentos. Solicita un código nuevo.");
      const matches = sameHash(challenge.codeHash, codeHash(uid, code));
      if (!matches) {
        const attempts = Number(challenge.attempts || 0) + 1;
        await challengeRef.update({ attempts });
        throw new HttpError(400, `El código no es correcto. Te quedan ${Math.max(0, MAX_ATTEMPTS - attempts)} intentos.`, { attemptsRemaining: Math.max(0, MAX_ATTEMPTS - attempts) });
      }
      await profileRef.update({ emailVerified: true, emailVerifiedAddress: email, emailVerifiedAt: now });
      await challengeRef.remove();
      return res.status(200).json({ verified: true, email });
    }

    throw new HttpError(400, "Acción desconocida.");
  } catch (error) {
    console.error("Email verification:", error);
    const status = error instanceof HttpError ? error.status : (/token|credential|argument/i.test(error?.code || "") ? 401 : 500);
    return res.status(status).json({ error: error.message || "No se pudo completar la verificación.", ...(error.extra || {}) });
  }
}
