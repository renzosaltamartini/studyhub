const SYMBOLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+-?/";
const params = new URLSearchParams(window.location.search);

function cleanSlug(value) {
    return (value || "usuario")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "usuario";
}

const suppliedName = (params.get("name") || "USUARIO").trim();
const slug = cleanSlug(params.get("slug") || suppliedName);
const displayName = suppliedName.toUpperCase();
const finalText = `BIENVENID@, ${displayName}`;

const welcomeText = document.getElementById("welcomeText");
const loadingStatus = document.getElementById("loadingStatus");

// Conserva una URL limpia: /hub/nombre/
const hubRootURL = new URL(".", document.baseURI);
const cleanURL = new URL(`${encodeURIComponent(slug)}/`, hubRootURL);
history.replaceState(null, "", cleanURL.pathname);

function randomCharacter(character) {
    if (character === " " || character === ",") return character;
    return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function decryptText(text) {
    return new Promise((resolve) => {
        let progress = 0;
        const revealSpeed = 0.42;

        const interval = window.setInterval(() => {
            welcomeText.textContent = [...text]
                .map((character, index) => index < progress ? character : randomCharacter(character))
                .join("");

            progress += revealSpeed;

            if (progress >= text.length) {
                window.clearInterval(interval);
                welcomeText.textContent = text;
                welcomeText.classList.add("is-resolved");
                resolve();
            }
        }, 45);
    });
}

async function startHubEntry() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
        welcomeText.textContent = finalText;
    } else {
        await decryptText(finalText);
    }

    loadingStatus.classList.remove("hidden");
    requestAnimationFrame(() => loadingStatus.classList.add("is-loading"));

    window.setTimeout(() => {
        const appURL = new URL(`app/`, cleanURL);
        window.location.replace(appURL.href);
    }, 4000);
}

startHubEntry();
