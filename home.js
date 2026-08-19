import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { firebaseConfig } from "/login/firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const btnComenzar = document.getElementById("btnComenzar");

onAuthStateChanged(auth, (user) => {
    if (user && btnComenzar) {
        const displayName = user.displayName || user.email?.split("@")[0] || "Usuario";
        const photoURL = user.photoURL;
        
        // Formatear el nombre para la URL (ej: /hub/juan-perez)
        const userSlug = displayName.toLowerCase().trim().replace(/\s+/g, '-');
        btnComenzar.href = `/hub/${userSlug}`;

        // Limpiar el contenido original del botón
        btnComenzar.innerHTML = "";

        // Avatar (Foto de perfil de Google o iniciales)
        if (photoURL) {
            const img = document.createElement("img");
            img.src = photoURL;
            img.alt = displayName;
            img.className = "nav-avatar-img";
            btnComenzar.appendChild(img);
        } else {
            const avatarDiv = document.createElement("div");
            avatarDiv.className = "nav-avatar-text";
            avatarDiv.textContent = displayName.slice(0, 2).toUpperCase();
            btnComenzar.appendChild(avatarDiv);
        }

        // Nombre con truncado por CSS (...)
        const nameSpan = document.createElement("span");
        nameSpan.className = "nav-user-name";
        nameSpan.textContent = displayName;
        btnComenzar.appendChild(nameSpan);

        // Clases opcionales para estilizar
        btnComenzar.classList.add("logged-in");
    }
});