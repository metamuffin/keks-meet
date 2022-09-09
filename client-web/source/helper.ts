/// <reference lib="dom" />

export function hex_id(len = 8): string {
    if (len > 8) return hex_id() + hex_id(len - 8)
    return Math.floor(Math.random() * 16 ** len).toString(16).padStart(len, "0")
}

const elem = (s: string) => document.createElement(s)
const elem_with_content = (s: string) => (c: string) => {
    const e = elem(s)
    e.textContent = c
    return e
}
const elem_with_children = (s: string) => (opts: { class?: string[] }, ...cs: (HTMLElement | string)[]) => {
    const e = elem(s)
    if (opts.class) e.classList.add(...opts.class)
    for (const c of cs) {
        e.append(c)
    }
    return e
}

export const ep = elem_with_content("p")
export const eh1 = elem_with_content("h1")
export const eh2 = elem_with_content("h2")
export const eh3 = elem_with_content("h3")
export const eh4 = elem_with_content("h4")
export const eh5 = elem_with_content("h5")
export const eh6 = elem_with_content("h6")
export const ediv = elem_with_children("div")

