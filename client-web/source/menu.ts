/// <reference lib="dom" />

export function create_menu() {
    const menu = document.createElement("div")
    menu.classList.add("menu-overlay")
    document.body.append(menu)

    const item = (name: string, cb: (() => void) | string) => {
        const p = document.createElement("p")
        const a = document.createElement("a")
        a.classList.add("menu-item")
        a.target = "_blank" // dont unload this meeting
        a.textContent = name
        if (typeof cb == "string") a.href = cb
        else a.addEventListener("click", cb), a.href = "#"
        p.append(a)
        return p
    }

    menu.append(
        item("Settings", () => alert("todo, refer to the url parameters in the docs for now")),
        item("Licence", "/licence"),
        item("Sources / Documentation", "https://codeberg.org/metamuffin/keks-meet"),
    )
}
