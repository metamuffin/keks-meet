/// <reference lib="dom" />



const elem = (s: string) => document.createElement(s)

interface Opts { class?: string[] | string, id?: string }

function apply_opts(e: HTMLElement, o: Opts | undefined) {
    if (!o) return
    if (o.id) e.id = o.id
    if (typeof o?.class == "string") e.classList.add(o.class)
    if (typeof o?.class == "object") e.classList.add(...o.class)
}
const elem_with_content = (s: string) => (c: string, opts?: Opts) => {
    const e = elem(s)
    apply_opts(e, opts)
    e.textContent = c
    return e
}
const elem_with_children = (s: string) => (opts?: Opts, ...cs: (HTMLElement | string)[]) => {
    const e = elem(s)
    apply_opts(e, opts)
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
export const espan = elem_with_content("span")
export const elabel = elem_with_content("label")

export const OVERLAYS = ediv({ class: "overlays" })


export class OverlayUi {
    _shown = false
    constructor(public el: HTMLElement, initial = false) {
        this.shown = initial
    }
    get shown() { return this._shown }
    set shown(v: boolean) {
        if (v && !this._shown) OVERLAYS.append(this.el)
        if (!v && this._shown) OVERLAYS.removeChild(this.el)
        this._shown = v
    }
}

