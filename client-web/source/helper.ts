/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin@disroot.org>
*/
/// <reference lib="dom" />

import { PREFS } from "./preferences/mod.ts";

interface Opts<E> {
    class?: string[] | string,
    id?: string,
    src?: string,
    for?: string,
    type?: string,
    href?: string,
    onclick?: (e: E) => void,
    onchange?: (e: E) => void,
    role?: "dialog"
    aria_label?: string
    aria_live?: "polite" | "assertive"
    aria_modal?: boolean
    aria_popup?: "menu"
}

function apply_opts<E extends HTMLElement>(e: E, o: Opts<E>) {
    if (o.id) e.id = o.id
    if (o.onclick) e.onclick = () => o.onclick!(e)
    if (o.onchange) e.onchange = () => o.onchange!(e)
    if (o.for) (e as unknown as HTMLLabelElement).htmlFor = o.for
    if (o.type && e instanceof HTMLInputElement) e.type = o.type
    if (o.href && e instanceof HTMLAnchorElement) e.href = o.href;
    if (typeof o?.class == "string") e.classList.add(o.class)
    if (typeof o?.class == "object") e.classList.add(...o.class)
    if (o.aria_modal) e.ariaModal = "true"
    if (o.aria_popup) e.ariaHasPopup = o.aria_popup
    if (o.aria_label) e.ariaLabel = o.aria_label
    if (o.aria_live) e.ariaLive = o.aria_live
}

export function e<K extends keyof HTMLElementTagNameMap>(name: K, opts: Opts<HTMLElementTagNameMap[K]>, ...children: (HTMLElement | string)[]): HTMLElementTagNameMap[K] {
    const el = document.createElement(name)
    apply_opts(el, opts)
    for (const c of children) {
        if (typeof c == "string") el.textContent += c;
        else el.append(c)
    }
    return el
}

export function image_view(url: string, opts?: Opts<HTMLElement>): HTMLElement {
    const img = document.createElement("img")
    apply_opts(img, opts ?? {})
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

export class EventEmitter<E> {
    private handlers: Set<(e: E) => unknown> = new Set()
    public dispatch(e: E) { this.handlers.forEach(h => h(e)) }
    public add_listener(listener: (e: E) => unknown) { this.handlers.add(listener) }
    public remove_listener(listener: (e: E) => unknown) { this.handlers.delete(listener) }
}
