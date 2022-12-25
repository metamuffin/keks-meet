/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
/// <reference lib="dom" />

import { PREFS } from "./preferences/mod.ts";

const elem = <K extends keyof HTMLElementTagNameMap>(s: K): HTMLElementTagNameMap[K] => document.createElement(s)

interface Opts<El> {
    class?: string[] | string,
    id?: string, src?: string,
    for?: string,
    onclick?: (e: El) => void,
    role?: "dialog"
    aria_label?: string
    aria_live?: "polite" | "assertive"
    aria_modal?: boolean
}

function apply_opts<El extends HTMLElement>(e: El, o: Opts<El> | undefined) {
    if (!o) return
    if (o.id) e.id = o.id
    if (o.onclick) e.onclick = () => o.onclick!(e)
    if (o.aria_label) e.ariaLabel = o.aria_label
    if (o.aria_live) e.ariaLive = o.aria_live
    if (o.for) (e as unknown as HTMLLabelElement).htmlFor = o.for
    if (o.aria_modal) e.ariaModal = "true"
    if (typeof o?.class == "string") e.classList.add(o.class)
    if (typeof o?.class == "object") e.classList.add(...o.class)
}
const elem_with_content = <K extends keyof HTMLElementTagNameMap>(s: K) => (c: string, opts?: Opts<HTMLElementTagNameMap[K]>) => {
    const e = elem(s)
    apply_opts(e, opts)
    e.textContent = c
    return e
}
const elem_with_children = <K extends keyof HTMLElementTagNameMap>(s: K) => (opts?: Opts<HTMLElementTagNameMap[K]>, ...cs: (HTMLElement | string)[]) => {
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
export const epre = elem_with_content("pre")
export const ediv = elem_with_children("div")
export const efooter = elem_with_children("footer")
export const esection = elem_with_children("section")
export const enav = elem_with_children("nav")
export const etr = elem_with_children("tr")
export const etd = elem_with_children("td")
export const eth = elem_with_children("th")
export const espan = elem_with_content("span")
export const elabel = elem_with_content("label")
export const ebutton = elem_with_content("button")
export const ebr = () => document.createElement("br")

export const OVERLAYS = ediv({ class: "overlays" })

export class OverlayUi {
    _shown = false
    constructor(public el: HTMLElement, initial = false) {
        this.shown = initial
    }
    get shown() { return this._shown }
    set shown(v: boolean) {
        if (v && !this._shown) OVERLAYS.append(this.el), this.on_show()
        if (!v && this._shown) OVERLAYS.removeChild(this.el), this.on_hide()
        this._shown = v
    }
    on_show() { }
    on_hide() { }
}

export function image_view(url: string, opts?: Opts<HTMLElement>): HTMLElement {
    const img = document.createElement("img")
    apply_opts(img, opts)
    img.src = url
    img.alt = `Image (click to open)`
    img.addEventListener("click", () => {
        window.open(url, "_blank", `noreferrer=true,noopener=true,popup=${PREFS.image_view_popup}`)
    })
    return img
}

export function notify(body: string, author?: string) {
    if (document.hasFocus()) return
    if (Notification.permission != "granted") return
    if (author)
        new Notification(`keks-meet: ${author}`, { body })
    else
        new Notification(`keks-meet`, { body })
}

export function sleep(delay: number) { return new Promise(r => setTimeout(r, delay)) }

export function display_filesize(n: number): string {
    if (n > 1000000000000) return (n / 1000000000000).toFixed(1) + "TB"
    if (n > 1000000000) return (n / 1000000000).toFixed(1) + "GB"
    if (n > 1000000) return (n / 1000000).toFixed(1) + "MB"
    if (n > 1000) return (n / 1000).toFixed(1) + "kB"
    return n.toString() + "B"
}
