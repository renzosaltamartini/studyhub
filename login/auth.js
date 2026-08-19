import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";

import {
    getAuth,
    GoogleAuthProvider,
    setPersistence,
    browserLocalPersistence,
    signInWithPopup,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    sendPasswordResetEmail,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    firebaseConfig
} from "./firebase-config.js";


// ===============================
// INICIALIZAR FIREBASE
// ===============================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
    prompt: "select_account"
});


// ===============================
// ELEMENTOS DEL HTML
// ===============================

const authForms = document.getElementById("authForms");
const accountView = document.getElementById("accountView");
const authForm = document.getElementById("authForm");

const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");

const nameField = document.getElementById("nameField");
const displayNameInput = document.getElementById("displayName");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const submitButton = document.getElementById("submitButton");
const googleButton = document.getElementById("googleButton");
const message = document.getElementById("message");

const forgotPasswordButton =
    document.getElementById("forgotPassword");

const passwordToggle =
    document.getElementById("passwordToggle");

const logoutButton =
    document.getElementById("logoutButton");

const formTitle =
    document.getElementById("form-title");

const formSubtitle =
    document.getElementById("form-subtitle");

const userName =
    document.getElementById("userName");

const userEmail =
    document.getElementById("userEmail");

const avatar =
    document.getElementById("avatar");


let currentMode = "login";


// ===============================
// MOSTRAR MENSAJES
// ===============================

function showMessage(text = "", success = false) {
    message.textContent = text;

    message.classList.toggle(
        "success-message",
        success
    );
}


// ===============================
// TRADUCIR ERRORES DE FIREBASE
// ===============================

function getReadableError(error) {
    const firebaseErrors = {
        "auth/email-already-in-use":
            "Ese email ya se encuentra registrado.",

        "auth/invalid-email":
            "El email ingresado no es válido.",

        "auth/invalid-credential":
            "El email o la contraseña son incorrectos.",

        "auth/user-not-found":
            "No existe una cuenta registrada con ese email.",

        "auth/wrong-password":
            "La contraseña ingresada es incorrecta.",

        "auth/weak-password":
            "La contraseña debe tener al menos 6 caracteres.",

        "auth/popup-closed-by-user":
            "La ventana de Google fue cerrada.",

        "auth/popup-blocked":
            "El navegador bloqueó la ventana de Google.",

        "auth/cancelled-popup-request":
            "La solicitud de acceso con Google fue cancelada.",

        "auth/network-request-failed":
            "No se pudo conectar. Revisa tu conexión a internet.",

        "auth/too-many-requests":
            "Demasiados intentos. Espera unos minutos.",

        "auth/unauthorized-domain":
            "Este dominio no está autorizado en Firebase."
    };

    return firebaseErrors[error.code] ||
        "Ocurrió un error. Intenta nuevamente.";
}


// ===============================
// CAMBIAR ENTRE LOGIN Y REGISTRO
// ===============================

function setMode(newMode) {
    currentMode = newMode;

    const isRegistering =
        currentMode === "register";

    loginTab.classList.toggle(
        "active",
        !isRegistering
    );

    registerTab.classList.toggle(
        "active",
        isRegistering
    );

    loginTab.setAttribute(
        "aria-selected",
        String(!isRegistering)
    );

    registerTab.setAttribute(
        "aria-selected",
        String(isRegistering)
    );

    nameField.classList.toggle(
        "hidden",
        !isRegistering
    );

    displayNameInput.required =
        isRegistering;

    passwordInput.autocomplete =
        isRegistering
            ? "new-password"
            : "current-password";

    forgotPasswordButton.classList.toggle(
        "hidden",
        isRegistering
    );

    formTitle.textContent =
        isRegistering
            ? "Crea tu cuenta"
            : "Bienvenido de nuevo";

    formSubtitle.textContent =
        isRegistering
            ? "Empieza a organizar tu estudio."
            : "Ingresa para continuar a tu Hub.";

    submitButton
        .querySelector("span")
        .textContent =
            isRegistering
                ? "Crear cuenta"
                : "Ingresar";

    showMessage();
}


loginTab.addEventListener("click", function () {
    setMode("login");
});


registerTab.addEventListener("click", function () {
    setMode("register");
});


// ===============================
// BLOQUEAR BOTONES MIENTRAS CARGA
// ===============================

function setLoading(isLoading) {
    submitButton.disabled = isLoading;
    googleButton.disabled = isLoading;
}


// ===============================
// EJECUTAR AUTENTICACIÓN
// ===============================

async function runAuthentication(action) {
    setLoading(true);
    showMessage();

    try {
        // Mantiene iniciada la sesión incluso después
        // de cerrar y volver a abrir el navegador.
        await setPersistence(
            auth,
            browserLocalPersistence
        );

        await action();
    } catch (error) {
        console.error(error);

        showMessage(
            getReadableError(error)
        );
    } finally {
        setLoading(false);
    }
}


// ===============================
// REGISTRO E INICIO CON EMAIL
// ===============================

authForm.addEventListener(
    "submit",
    function (event) {
        event.preventDefault();

        if (!authForm.checkValidity()) {
            authForm.reportValidity();
            return;
        }

        const email =
            emailInput.value.trim();

        const password =
            passwordInput.value;

        runAuthentication(async function () {
            if (currentMode === "register") {
                const name =
                    displayNameInput.value.trim();

                const credential =
                    await createUserWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );

                await updateProfile(
                    credential.user,
                    {
                        displayName: name
                    }
                );
            } else {
                await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );
            }
        });
    }
);


// ===============================
// INICIAR SESIÓN CON GOOGLE
// ===============================

googleButton.addEventListener(
    "click",
    function () {
        runAuthentication(
            async function () {
                await signInWithPopup(
                    auth,
                    googleProvider
                );
            }
        );
    }
);


// ===============================
// RECUPERAR CONTRASEÑA
// ===============================

forgotPasswordButton.addEventListener(
    "click",
    async function () {
        const email =
            emailInput.value.trim();

        if (email === "") {
            showMessage(
                "Escribe tu email para recuperar la contraseña."
            );

            emailInput.focus();
            return;
        }

        await runAuthentication(
            async function () {
                await sendPasswordResetEmail(
                    auth,
                    email
                );

                showMessage(
                    "Te enviamos un enlace para restablecer tu contraseña.",
                    true
                );
            }
        );
    }
);


// ===============================
// MOSTRAR U OCULTAR CONTRASEÑA
// ===============================

passwordToggle.addEventListener(
    "click",
    function () {
        const passwordIsVisible =
            passwordInput.type === "text";

        passwordInput.type =
            passwordIsVisible
                ? "password"
                : "text";

        passwordToggle.innerHTML =
            passwordIsVisible
                ? '<i class="fa-regular fa-eye"></i>'
                : '<i class="fa-regular fa-eye-slash"></i>';

        passwordToggle.setAttribute(
            "aria-label",
            passwordIsVisible
                ? "Mostrar contraseña"
                : "Ocultar contraseña"
        );
    }
);


// ===============================
// CERRAR SESIÓN
// ===============================

logoutButton.addEventListener(
    "click",
    async function () {
        try {
            await signOut(auth);
        } catch (error) {
            console.error(
                "No se pudo cerrar la sesión:",
                error
            );
        }
    }
);


// ===============================
// DETECTAR SESIÓN INICIADA
// ===============================

onAuthStateChanged(
    auth,
    function (user) {
        const userIsLoggedIn =
            Boolean(user);

        authForms.classList.toggle(
            "hidden",
            userIsLoggedIn
        );

        accountView.classList.toggle(
            "hidden",
            !userIsLoggedIn
        );

        if (!user) {
            return;
        }

        const name =
            user.displayName ||
            user.email?.split("@")[0] ||
            "estudiante";

        userName.textContent = name;

        userEmail.textContent =
            user.email ||
            "Cuenta de Google";

        avatar.textContent =
            name
                .slice(0, 2)
                .toUpperCase();
    }
);