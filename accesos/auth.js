import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
    getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence,
    signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    updateProfile, sendPasswordResetEmail, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { firebaseConfig } from "/accesos/firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const $ = (id) => document.getElementById(id);
const authForms = $("authForms"), accountView = $("accountView"), authForm = $("authForm");
const loginTab = $("loginTab"), registerTab = $("registerTab");
const registerFields = $("registerFields"), registerExtraFields = $("registerExtraFields");
const firstName = $("firstName"), lastName = $("lastName"), email = $("email"), password = $("password");
const confirmPassword = $("confirmPassword"), organization = $("organization"), occupation = $("occupation");
const submitButton = $("submitButton"), googleButton = $("googleButton"), message = $("message");
let mode = "login";

function showMessage(text = "", success = false) {
    message.textContent = text;
    message.classList.toggle("success-message", success);
}

function readableError(error) {
    const errors = {
        "auth/email-already-in-use": "Ese email ya está registrado.",
        "auth/invalid-email": "El email ingresado no es válido.",
        "auth/invalid-credential": "El email o la contraseña son incorrectos.",
        "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
        "auth/popup-closed-by-user": "La ventana de Google fue cerrada.",
        "auth/popup-blocked": "El navegador bloqueó la ventana de Google.",
        "auth/network-request-failed": "No se pudo conectar. Revisa tu conexión."
    };
    return errors[error.code] || "Ocurrió un error. Intenta nuevamente.";
}

function setMode(nextMode) {
    if (mode === nextMode) return;
    mode = nextMode;
    const registering = mode === "register";
    loginTab.classList.toggle("active", !registering);
    registerTab.classList.toggle("active", registering);
    loginTab.setAttribute("aria-selected", String(!registering));
    registerTab.setAttribute("aria-selected", String(registering));
    registerFields.classList.toggle("hidden", !registering);
    registerExtraFields.classList.toggle("hidden", !registering);
    firstName.required = registering;
    lastName.required = registering;
    confirmPassword.required = registering;
    occupation.required = registering;
    password.autocomplete = registering ? "new-password" : "current-password";
    $("forgotPassword").classList.toggle("hidden", registering);
    $("form-title").textContent = registering ? "Crea tu cuenta" : "Bienvenido de nuevo";
    $("form-subtitle").textContent = registering ? "Empieza a organizar tu estudio." : "Ingresa para continuar a tu Hub.";
    submitButton.querySelector("span").textContent = registering ? "Crear cuenta" : "Ingresar";
    $("authForms").classList.remove("form-transition");
    void $("authForms").offsetWidth;
    $("authForms").classList.add("form-transition");
    showMessage();
}

async function runAuth(action) {
    submitButton.disabled = googleButton.disabled = true;
    showMessage();
    try { await setPersistence(auth, browserLocalPersistence); await action(); }
    catch (error) { showMessage(readableError(error)); }
    finally { submitButton.disabled = googleButton.disabled = false; }
}

loginTab.addEventListener("click", () => setMode("login"));
registerTab.addEventListener("click", () => setMode("register"));

authForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!authForm.checkValidity()) return authForm.reportValidity();
    runAuth(async () => {
        if (mode === "register") {
            if (password.value !== confirmPassword.value) {
                showMessage("Las contraseñas no coinciden.");
                confirmPassword.focus();
                return;
            }
            const credential = await createUserWithEmailAndPassword(auth, email.value.trim(), password.value);
            const fullName = `${firstName.value.trim()} ${lastName.value.trim()}`;
            await updateProfile(credential.user, { displayName: fullName });
            await setDoc(doc(db, "users", credential.user.uid), {
                firstName: firstName.value.trim(),
                lastName: lastName.value.trim(),
                email: email.value.trim(),
                organization: organization.value.trim(),
                occupation: occupation.value,
                createdAt: serverTimestamp()
            });
        } else {
            await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
        }
    });
});

googleButton.addEventListener("click", () => runAuth(() => signInWithPopup(auth, provider)));

$("forgotPassword").addEventListener("click", async () => {
    if (!email.value.trim()) { showMessage("Escribe tu email para recuperar la contraseña."); email.focus(); return; }
    await runAuth(async () => { await sendPasswordResetEmail(auth, email.value.trim()); showMessage("Te enviamos un enlace para restablecerla.", true); });
});

$("passwordToggle").addEventListener("click", () => {
    const visible = password.type === "text";
    password.type = visible ? "password" : "text";
    $("passwordToggle").innerHTML = `<i class="fa-regular fa-eye${visible ? "" : "-slash"}"></i>`;
    $("passwordToggle").setAttribute("aria-label", visible ? "Mostrar contraseña" : "Ocultar contraseña");
});

$("confirmPasswordToggle").addEventListener("click", () => {
    const visible = confirmPassword.type === "text";
    confirmPassword.type = visible ? "password" : "text";
    $("confirmPasswordToggle").innerHTML = `<i class="fa-regular fa-eye${visible ? "" : "-slash"}"></i>`;
    $("confirmPasswordToggle").setAttribute("aria-label", visible ? "Mostrar confirmación" : "Ocultar confirmación");
});

$("logoutButton").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    authForms.classList.toggle("hidden", Boolean(user));
    accountView.classList.toggle("hidden", !user);
    if (!user) return;
    const name = user.displayName || user.email?.split("@")[0] || "estudiante";
    $("userName").textContent = name;
    $("userEmail").textContent = user.email || "Cuenta de Google";
    $("avatar").textContent = name.slice(0, 2).toUpperCase();
});
