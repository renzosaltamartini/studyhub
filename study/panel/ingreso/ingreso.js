import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getDatabase, ref, get, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";
import { firebaseConfig } from "/firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const $ = (id) => document.getElementById(id);
let currentUser = null;

function showError(message) {
    $("formError").textContent = message;
    $("formError").classList.remove("hidden");
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

$("occupation").addEventListener("change", updateOccupationField);

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("/study/panel");
        return;
    }
    currentUser = user;
    try {
        const snapshot = await get(ref(database, `users/${user.uid}/profile`));
        if (snapshot.val()?.completed) {
            window.location.replace("/study/panel");
            return;
        }
        $("fullName").value = user.displayName || "Usuario de Google";
        $("email").value = user.email || "Sin email disponible";
        $("loadingView").classList.add("hidden");
        $("formView").classList.remove("hidden");
    } catch (error) {
        console.error(error);
        showError("No pudimos comprobar tu perfil. Revisa tu conexión e inténtalo nuevamente.");
        $("loadingView").classList.add("hidden");
        $("formView").classList.remove("hidden");
    }
});

$("intakeForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    $("formError").classList.add("hidden");
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
            fullName: currentUser.displayName || "Usuario de Google",
            email: currentUser.email || "",
            age,
            country,
            address,
            occupation,
            occupationDetail,
            completedAt: serverTimestamp()
        });
        window.location.replace("/study/panel");
    } catch (error) {
        console.error(error);
        showError("No se pudo guardar el perfil. Verifica las reglas de Realtime Database e inténtalo otra vez.");
        $("submitButton").disabled = false;
        $("submitButton").textContent = "Guardar y entrar al panel";
    }
});
