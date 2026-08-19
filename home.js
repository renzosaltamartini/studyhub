import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import { firebaseConfig } from "/login/firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const btnComenzar = document.getElementById("btnComenzar");

onAuthStateChanged(auth, (user) => {
    if (!btnComenzar) return;

    if (user) {
        const displayName =
            user.displayName ||
            user.email?.split("@")[0] ||
            "Usuario";

        const photoURL = user.photoURL;

        // Si hay una sesión iniciada, dirige a la página de accesos.
        btnComenzar.href = "/accesos";
        btnComenzar.setAttribute(
            "aria-label",
            `Ir a los accesos de ${displayName}`
        );

        // Elimina el contenido original del botón.
        btnComenzar.innerHTML = "";

        // Muestra la foto de Google o las iniciales.
        if (photoURL) {
            const img = document.createElement("img");

            img.src = photoURL;
            img.alt = displayName;
            img.className = "nav-avatar-img";

            btnComenzar.appendChild(img);
        } else {
            const avatarDiv = document.createElement("div");

            avatarDiv.className = "nav-avatar-text";
            avatarDiv.textContent = displayName
                .slice(0, 2)
                .toUpperCase();

            btnComenzar.appendChild(avatarDiv);
        }

        // Muestra el nombre del usuario.
        const nameSpan = document.createElement("span");

        nameSpan.className = "nav-user-name";
        nameSpan.textContent = displayName;

        btnComenzar.appendChild(nameSpan);
        btnComenzar.classList.add("logged-in");

        return;
    }

    // Si no hay una sesión iniciada, dirige al login.
    btnComenzar.href = "/login";
    btnComenzar.setAttribute(
        "aria-label",
        "Comenzar en StudyHub"
    );

    btnComenzar.classList.remove("logged-in");

    btnComenzar.innerHTML = `
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
            />

            <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.13C3.26 21.3 7.31 24 12 24z"
            />

            <path
                fill="#FBBC05"
                d="M5.28 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.63H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.37l3.99-3.13z"
            />

            <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.63l3.99-3.13c.95-2.85 3.6-4.96 6.72-4.96z"
            />
        </svg>

        <span>Comenzar</span>
    `;
});