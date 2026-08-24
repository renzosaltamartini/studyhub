import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getDatabase, ref, get, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";
import { firebaseConfig } from "/firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const $ = (id) => document.getElementById(id);
let currentUser = null;
let cooldownTimer = null;
let cooldownEndsAt = 0;

function showError(message, target = "formError") {
    $(target).textContent = message;
    $(target).classList.remove("hidden");
}

function clearMessage(target) {
    $(target).textContent = "";
    $(target).classList.add("hidden");
}

function showView(name) {
    $("loadingView").classList.toggle("hidden", name !== "loading");
    $("formView").classList.toggle("hidden", name !== "form");
    $("verificationView").classList.toggle("hidden", name !== "verification");
}

function updateOccupationField() {
    const value = $("occupation").value;
    const needsDetail = value === "profesional" || value === "estudiante";
    $("occupationDetailField").classList.toggle("hidden", !needsDetail);
    $("occupationDetail").required = needsDetail;
    $("occupationDetailLabel").textContent = value === "profesional" ? "¿A qué te dedicas?" : "¿Qué estudias?";
    $("occupationDetail").placeholder = value === "profesional" ? "Ej.: Desarrollador de software" : "Ej.: Ingeniería en Informática";
    if (!needsDetail) $("occupationDetail").value = "";
}

async function verificationAPI(action, payload = {}) {
    if (!currentUser) throw new Error("Tu sesión no está disponible.");
    const token = await currentUser.getIdToken();
    const response = await fetch("/api/email-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, ...payload })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error || "No se pudo completar la verificación.");
        Object.assign(error, data);
        throw error;
    }
    return data;
}

function renderCooldown() {
    const button = $("resendCodeButton");
    const seconds = Math.max(0, Math.ceil((cooldownEndsAt - Date.now()) / 1000));
    if (seconds > 0) {
        button.disabled = true;
        button.textContent = `Reenviar código en ${seconds} s`;
    } else {
        button.disabled = false;
        button.textContent = "Reenviar código";
        if (cooldownTimer) window.clearInterval(cooldownTimer);
        cooldownTimer = null;
    }
}

function startCooldown(nextSendAt) {
    cooldownEndsAt = Math.max(Date.now(), Number(nextSendAt || 0));
    if (cooldownTimer) window.clearInterval(cooldownTimer);
    renderCooldown();
    if (cooldownEndsAt > Date.now()) cooldownTimer = window.setInterval(renderCooldown, 250);
}

function showVerification(email) {
    $("verificationEmail").textContent = email || "tu correo";
    showView("verification");
    window.setTimeout(() => $("verificationCode").focus(), 80);
}

async function requestCode(silent = false) {
    clearMessage("verificationError");
    const button = $("resendCodeButton");
    button.disabled = true;
    if (!silent) button.textContent = "Enviando...";
    try {
        const data = await verificationAPI("send");
        if (data.verified) return window.location.replace("/study/panel");
        startCooldown(data.nextSendAt || Date.now() + 30_000);
        $("verificationNotice").textContent = `Enviamos un código de 6 números a ${data.email}.`;
        $("verificationNotice").classList.remove("hidden");
    } catch (error) {
        if (error.nextSendAt || error.retryAfter) startCooldown(error.nextSendAt || Date.now() + Number(error.retryAfter) * 1000);
        showError(error.message, "verificationError");
        if (!cooldownTimer) button.disabled = false;
    }
}

async function restoreVerificationState() {
    try {
        const status = await verificationAPI("status");
        if (status.verified) return window.location.replace("/study/panel");
        startCooldown(status.nextSendAt);
        if (!status.hasActiveCode && status.retryAfter === 0) await requestCode(true);
    } catch (error) {
        showError(error.message, "verificationError");
        $("resendCodeButton").disabled = false;
    }
}

$("occupation").addEventListener("change", updateOccupationField);
$("verificationCode").addEventListener("input", (event) => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 6);
    clearMessage("verificationError");
});
$("resendCodeButton").addEventListener("click", () => requestCode(false));

onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.replace("/study/panel");
    currentUser = user;
    try {
        const snapshot = await get(ref(database, `users/${user.uid}/profile`));
        const profile = snapshot.val() || {};
        if (profile.completed && profile.emailVerified === true && profile.emailVerifiedAddress === (user.email || "").toLowerCase()) {
            window.location.replace("/study/panel");
            return;
        }
        $("fullName").value = user.displayName || "Usuario de Google";
        $("email").value = user.email || "Sin email disponible";
        if (profile.completed) {
            showVerification(user.email);
            await restoreVerificationState();
        } else {
            showView("form");
        }
    } catch (error) {
        console.error(error);
        showView("form");
        showError("No pudimos comprobar tu perfil. Revisa tu conexión e inténtalo nuevamente.");
    }
});

$("intakeForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage("formError");
    if (!currentUser) return showError("Tu sesión no está disponible.");
    const age = Number($("age").value);
    const country = $("country").value.trim();
    const address = $("address").value.trim();
    const occupation = $("occupation").value;
    const occupationDetail = $("occupationDetail").value.trim();
    if (!Number.isInteger(age) || age < 13 || age > 120) return showError("Ingresa una edad válida entre 13 y 120 años.");
    if (!country || !address || !occupation) return showError("Completa todos los campos obligatorios.");
    if ((occupation === "profesional" || occupation === "estudiante") && !occupationDetail) return showError("Completa el detalle de tu ocupación.");

    $("submitButton").disabled = true;
    $("submitButton").textContent = "Guardando...";
    try {
        await set(ref(database, `users/${currentUser.uid}/profile`), {
            completed: true,
            emailVerified: false,
            fullName: currentUser.displayName || "Usuario de Google",
            email: currentUser.email || "",
            age, country, address, occupation, occupationDetail,
            completedAt: serverTimestamp()
        });
        showVerification(currentUser.email);
        await requestCode(true);
    } catch (error) {
        console.error(error);
        showError(error.message || "No se pudo guardar el perfil o enviar el código. Inténtalo otra vez.");
        $("submitButton").disabled = false;
        $("submitButton").textContent = "Guardar y verificar correo";
    }
});

$("verificationForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage("verificationError");
    const code = $("verificationCode").value.trim();
    if (!/^\d{6}$/.test(code)) return showError("Ingresa los seis números del código.", "verificationError");
    const button = $("verifyCodeButton");
    button.disabled = true;
    button.textContent = "Verificando...";
    try {
        await verificationAPI("verify", { code });
        $("verificationSuccess").classList.remove("hidden");
        $("verificationCode").disabled = true;
        window.setTimeout(() => window.location.replace("/study/panel"), 800);
    } catch (error) {
        showError(error.message, "verificationError");
        button.disabled = false;
        button.textContent = "Verificar correo";
        $("verificationCode").select();
    }
});
