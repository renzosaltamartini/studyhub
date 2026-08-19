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
const hubView = $("hubView");

// Se capturan ANTES de tocar el historial, porque history.replaceState cambia
// la URL base del documento y rompería la resolución de rutas relativas más adelante.
// Así el sitio funciona igual esté publicado en la raíz del dominio o en un subpath
// (por ejemplo GitHub Pages de proyecto: usuario.github.io/studyhub/).
const studyBaseURL = new URL(".", document.baseURI); // .../study/
const siteRootURL = new URL("..", studyBaseURL); // .../

$("brandLink").href = siteRootURL.href;
$("backButton").href = siteRootURL.href;

// Si el hosting estático redirigió acá una URL como /study/renzo/hub/ (ver /404.html),
// el path original quedó guardado en sessionStorage. Lo recuperamos y limpiamos.
const storedPath = sessionStorage.getItem("sh-redirect-path");
if (storedPath) sessionStorage.removeItem("sh-redirect-path");
const rawPath = storedPath || window.location.pathname;

const allParts = rawPath
    .split(/[?#]/)[0]
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);

// Busca el segmento "study" para no depender de si el sitio vive en la raíz
// o en un subpath (ej: ["studyhub","study","renzo","hub"] o ["study","renzo"]).
const studyIndex = allParts.lastIndexOf("study");
const segments = studyIndex !== -1 ? allParts.slice(studyIndex) : allParts;

const urlSlug = segments[1] || "";
const isHubRoute = segments[2] === "hub";

function showOnly(view) {
    [loadingView, panelView, hubView].forEach((el) => el?.classList.add("hidden"));
    view?.classList.remove("hidden");
}

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
    $("hubLink").href = new URL(`${slug}/hub/`, studyBaseURL).href;
}

function renderHub(slug, displayName) {
    $("hubUserName").textContent = displayName;
    $("backToPanel").href = new URL(`${slug}/`, studyBaseURL).href;
}

async function logout() {
    await signOut(auth);
    window.location.href = siteRootURL.href;
}

$("logoutButton")?.addEventListener("click", logout);
$("hubLogoutButton")?.addEventListener("click", logout);

onAuthStateChanged(auth, (user) => {
    // Ruta protegida: sin sesión no hay panel ni Hub. Se vuelve al inicio para loguearse con Google.
    if (!user) {
        window.location.replace(siteRootURL.href);
        return;
    }

    const displayName = user.displayName || user.email?.split("@")[0] || "Usuario";
    const slug = slugify(displayName);
    const correctURL = isHubRoute
        ? new URL(`${slug}/hub/`, studyBaseURL)
        : new URL(`${slug}/`, studyBaseURL);

    // Corrige la URL visible del navegador (por ejemplo tras el redirect de /404.html,
    // o si el slug en la dirección no coincide con el usuario logeado).
    if (urlSlug !== slug || storedPath) {
        history.replaceState(null, "", correctURL.pathname + correctURL.search);
    }

    if (isHubRoute) {
        renderHub(slug, displayName);
        showOnly(hubView);
    } else {
        renderPanel(user, slug, displayName);
        showOnly(panelView);
    }
});
