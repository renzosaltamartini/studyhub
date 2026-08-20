import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import { firebaseConfig } from "../firebase-config.js";
import { slugify } from "../slug.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

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

// Se capturan ANTES de tocar el historial, porque history.replaceState cambia
// la URL base del documento y rompería la resolución de rutas relativas más adelante.
// Así el sitio funciona igual esté publicado en la raíz del dominio o en un subpath
// (por ejemplo GitHub Pages de proyecto: usuario.github.io/studyhub/).
const panelBaseURL = new URL(".", document.baseURI); // .../study/panel/
const studyBaseURL = new URL("..", panelBaseURL); // .../study/
const siteRootURL = new URL("..", studyBaseURL); // .../

$("brandLink").href = siteRootURL.href;
$("backButton").href = siteRootURL.href;

const rawPath = window.location.pathname;

const allParts = rawPath
    .split(/[?#]/)[0]
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);

// Busca el segmento "study" para no depender de si el sitio vive en la raíz
// o en un subpath (ej: ["studyhub","study","panel","renzo"]).
const studyIndex = allParts.lastIndexOf("study");
const segments = studyIndex !== -1 ? allParts.slice(studyIndex) : allParts;

const urlSlug = segments[1] === "panel" ? (segments[2] || "") : "";

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

function renderPanel(user, slug, displayName) {
    fillAvatar($("avatar"), user, displayName);
    $("userName").textContent = displayName;
    $("userEmail").textContent = user.email || "Cuenta de Google";
    $("hubLink").href = new URL(`hub/index.html?name=${encodeURIComponent(slug)}`, studyBaseURL).href;
}

async function logout() {
    await signOut(auth);
    window.location.href = siteRootURL.href;
}

$("logoutButton")?.addEventListener("click", logout);

onAuthStateChanged(auth, (user) => {
    // Ruta protegida: sin sesión no hay panel. Se vuelve al inicio para iniciar con Google.
    if (!user) {
        window.location.replace(siteRootURL.href);
        return;
    }

    const displayName = user.displayName || user.email?.split("@")[0] || "Usuario";
    const slug = slugify(displayName);
    const correctURL = new URL(`${slug}/`, panelBaseURL);

    // Corrige la URL visible si el nombre de la dirección no coincide con el usuario logueado.
    if (urlSlug !== slug || segments.length > 3) {
        history.replaceState(null, "", correctURL.pathname + correctURL.search);
    }

    renderPanel(user, slug, displayName);
    loadingView.classList.add("hidden");
    panelView.classList.remove("hidden");
});
