(() => {
    const STORAGE_KEY = "studyhub-theme";

    function readTheme() {
        return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
    }

    function updateButtons(dark) {
        document.querySelectorAll(".theme-toggle").forEach((button) => {
            button.setAttribute("aria-label", dark ? "Activar tema claro" : "Activar tema oscuro");
            button.setAttribute("title", dark ? "Tema claro" : "Tema oscuro");
            const icon = button.querySelector("i");
            if (icon) icon.className = dark ? "fa-regular fa-sun" : "fa-regular fa-moon";
        });
    }

    function applyTheme(theme, persist = false) {
        const dark = theme === "dark";
        document.documentElement.classList.toggle("dark-theme", dark);
        if (document.body) document.body.classList.toggle("dark-theme", dark);
        if (persist) localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
        updateButtons(dark);
    }

    function bindButtons() {
        updateButtons(readTheme() === "dark");
        document.querySelectorAll(".theme-toggle").forEach((button) => {
            if (button.dataset.themeBound === "true") return;
            button.dataset.themeBound = "true";
            button.addEventListener("click", () => {
                const nextTheme = document.documentElement.classList.contains("dark-theme") ? "light" : "dark";
                applyTheme(nextTheme, true);
            });
        });
    }

    applyTheme(readTheme());

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            applyTheme(readTheme());
            bindButtons();
        }, { once: true });
    } else {
        applyTheme(readTheme());
        bindButtons();
    }

    window.addEventListener("storage", (event) => {
        if (event.key === STORAGE_KEY) applyTheme(readTheme());
    });
})();
