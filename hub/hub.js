import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { firebaseConfig } from "/login/firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const loading = document.getElementById("loading");
const welcomeView = document.getElementById("welcomeView");
const deniedView = document.getElementById("deniedView");
const userName = document.getElementById("userName");
const avatarContainer = document.getElementById("avatarContainer");
const logoutBtn = document.getElementById("logoutBtn");

onAuthStateChanged(auth, (user) => {
    loading.classList.add("hidden");

    if (user) {
        // Usuario logueado: mostrar bienvenida
        const name = user.displayName || user.email?.split("@")[0] || "Estudiante";
        userName.textContent = name;

        avatarContainer.innerHTML = "";
        if (user.photoURL) {
            const img = document.createElement("img");
            img.src = user.photoURL;
            img.alt = name;
            img.className = "user-avatar-large";
            avatarContainer.appendChild(img);
        } else {
            const avatar = document.createElement("div");
            avatar.className = "avatar-placeholder-large";
            avatar.textContent = name.slice(0, 2).toUpperCase();
            avatarContainer.appendChild(avatar);
        }

        welcomeView.classList.remove("hidden");
    } else {
        // Usuario no logueado: bloquear acceso
        deniedView.classList.remove("hidden");
    }
});

logoutBtn.addEventListener("click", () => {
    signOut(auth).then(() => {
        window.location.href = "/";
    });
});