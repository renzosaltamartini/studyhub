import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import { firebaseConfig } from "/firebase-config.js";
import { slugify } from "/slug.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const $ = (id) => document.getElementById(id);
const loadingView = $("loadingView");
const panelView = $("panelView");
const hubView = $("hubView");

// Si el hosting estático redirigió acá una URL como /study/renzo/hub/ (ver /404.html),
// el path original quedó guardado en sessionStorage. Lo recuperamos y limpiamos.
const storedPath = sessionStorage.getItem("sh-redirect-path");
if (storedPath) sessionStorage.removeItem("sh-redirect-path");
const rawPath = storedPath || window.location.pathname;

const segments = rawPath
    .split(/[?#]/)[0]
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean); // ej: ["study", "renzo-saltamartini", "hub"]

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
    $("hubLink").href = `/study/${slug}/hub/`;
}

function renderHub(slug, displayName) {
    $("hubUserName").textContent = displayName;
    $("backToPanel").href = `/study/${slug}/`;
}

async function logout() {
    await signOut(auth);
    window.location.href = "/";
}

$("logoutButton")?.addEventListener("click", logout);
$("hubLogoutButton")?.addEventListener("click", logout);

onAuthStateChanged(auth, (user) => {
    // Ruta protegida: sin sesión no hay panel ni Hub. Se vuelve al inicio para loguearse con Google.
    if (!user) {
        window.location.replace("/");
        return;
    }

    const displayName = user.displayName || user.email?.split("@")[0] || "Usuario";
    const slug = slugify(displayName);
    const correctPath = isHubRoute ? `/study/${slug}/hub/` : `/study/${slug}/`;

    // Corrige la URL visible del navegador (por ejemplo tras el redirect de /404.html,
    // o si el slug en la dirección no coincide con el usuario logeado).
    if (urlSlug !== slug || storedPath) {
        history.replaceState(null, "", correctPath);
    }

    if (isHubRoute) {
        renderHub(slug, displayName);
        showOnly(hubView);
    } else {
        renderPanel(user, slug, displayName);
        showOnly(panelView);
    }
});
