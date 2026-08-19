// Convierte un nombre ("Renzo Saltamartini") en un slug para la URL ("renzo-saltamartini").
export function slugify(name) {
    return (
        (name || "usuario")
            .toString()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // quita acentos
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "usuario"
    );
}
