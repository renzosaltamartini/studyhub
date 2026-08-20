import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    setPersistence,
    browserLocalPersistence,
    signInWithPopup,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import { firebaseConfig } from "../firebase-config.js";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const $ = (id) => document.getElementById(id);
const loadingView = $("loadingView");
const panelView = $("panelView");

const spaceWords = [
    { text: "estudio", background: "#eff6ff", color: "#2563eb", border: "#dbeafe" },
    { text: "aprendizaje", background: "#ecfdf5", color: "#059669", border: "#d1fae5" },
    { text: "comodidad", background: "#f5f3ff", color: "#7c3aed", border: "#ede9fe" },
    { text: "organización", background: "#fff7ed", color: "#ea580c", border: "#fed7aa" },
    { text: "facilidad", background: "#fff1f2", color: "#e11d48", border: "#fecdd3" }
];

const spaceWord = $("spaceWord");
const spaceEyebrow = spaceWord?.closest(".space-eyebrow");
const spaceDot = spaceEyebrow?.querySelector(".status-dot");
let spaceWordIndex = 0;

function measureWordWidth(text) {
    if (!spaceWord) return 0;
    const probe = document.createElement("span");
    const styles = window.getComputedStyle(spaceWord);
    probe.textContent = text;
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.whiteSpace = "nowrap";
    probe.style.font = styles.font;
    probe.style.letterSpacing = styles.letterSpacing;
    document.body.appendChild(probe);
    const width = Math.ceil(probe.getBoundingClientRect().width) + 2;
    probe.remove();
    return width;
}

function resizeSpaceWord(text, animate = true) {
    if (!spaceWord) return;
    if (!animate) spaceWord.style.transition = "none";
    spaceWord.style.width = `${measureWordWidth(text)}px`;
    if (!animate) {
        void spaceWord.offsetWidth;
        spaceWord.style.removeProperty("transition");
    }
}

function rotateSpaceWord() {
    if (!spaceWord || !spaceEyebrow) return;
    spaceWord.classList.remove("is-entering");
    spaceWord.classList.add("is-leaving");

    window.setTimeout(() => {
        spaceWordIndex = (spaceWordIndex + 1) % spaceWords.length;
        const nextWord = spaceWords[spaceWordIndex];
        spaceWord.textContent = nextWord.text;
        spaceEyebrow.style.backgroundColor = nextWord.background;
        spaceEyebrow.style.color = nextWord.color;
        spaceEyebrow.style.borderColor = nextWord.border;
        if (spaceDot) spaceDot.style.color = nextWord.color;
        resizeSpaceWord(nextWord.text);
        spaceWord.classList.remove("is-leaving");
        void spaceWord.offsetWidth;
        spaceWord.classList.add("is-entering");
    }, 200);
}

resizeSpaceWord(spaceWords[0].text, false);
if (spaceDot) spaceDot.style.color = spaceWords[0].color;

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.setInterval(rotateSpaceWord, 2500);
}

// Rutas públicas fijas: el nombre del usuario nunca forma parte de la URL.
const siteRootURL = new URL("/", window.location.origin);
const studyBaseURL = new URL("study/", siteRootURL);

$("brandLink").href = siteRootURL.href;
$("backButton").href = siteRootURL.href;

function fillAvatar(container, user, displayName) {
    container.innerHTML = "";
    if (user.photoURL) {
        const img = document.createElement("img");
        img.src = user.photoURL;
        img.alt = displayName;
        img.referrerPolicy = "no-referrer";
        container.appendChild(img);
    } else {
        container.textContent = displayName.slice(0, 2).toUpperCase();
    }
}

function renderLoggedIn(user, displayName) {
    fillAvatar($("avatar"), user, displayName);
    $("userName").textContent = displayName;
    $("userEmail").textContent = user.email || "Cuenta de Google";
    $("sessionStatus").innerHTML = '<span class="status-dot"></span>Sesión iniciada';
    if ($("hubLink")) $("hubLink").href = new URL("hub/", studyBaseURL).href;
    $("loginButton")?.classList.add("hidden");
    $("loggedActions")?.classList.remove("hidden");
}

function renderLoggedOut() {
    const avatar = $("avatar");
    avatar.innerHTML = '<i class="fa-brands fa-google" aria-hidden="true"></i>';
    $("sessionStatus").innerHTML = '<span class="status-dot"></span>Sesión no iniciada';
    $("greeting").textContent = "Debes iniciar sesión";
    $("userEmail").textContent = "Inicia sesión con Google para acceder a tu espacio.";
    $("loggedActions")?.classList.add("hidden");
    $("loginButton")?.classList.remove("hidden");
}

async function login() {
    const button = $("loginButton");
    if (button?.classList.contains("loading")) return;
    button?.classList.add("loading");
    try {
        await setPersistence(auth, browserLocalPersistence);
        await signInWithPopup(auth, provider);
    } catch (error) {
        if (error.code !== "auth/popup-closed-by-user") {
            console.error("No se pudo iniciar sesión con Google:", error);
        }
    } finally {
        button?.classList.remove("loading");
    }
}

async function logout() {
    await signOut(auth);
    window.location.href = siteRootURL.href;
}

$("logoutButton")?.addEventListener("click", logout);
$("loginButton")?.addEventListener("click", login);

onAuthStateChanged(auth, (user) => {
    if (user) {
        const displayName = user.displayName || user.email?.split("@")[0] || "Usuario";
        renderLoggedIn(user, displayName);
    } else {
        renderLoggedOut();
    }
    loadingView.classList.add("hidden");
    panelView.classList.remove("hidden");
});
