/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
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
    alt?: string,
    onclick?: (e: E) => void,
    onchange?: (e: E) => void,
    role?: "dialog"
    aria_label?: string
    aria_live?: "polite" | "assertive"
    aria_modal?: boolean
    aria_popup?: "menu"
    icon?: string,
    hidden?: boolean,
}

function apply_opts<E extends HTMLElement>(el: E, o: Opts<E>) {
    if (o.id) el.id = o.id
    if (o.onclick) el.onclick = () => o.onclick!(el)
    if (o.onchange) el.onchange = () => o.onchange!(el)
    if (o.for) (el as unknown as HTMLLabelElement).htmlFor = o.for
    if (o.type && el instanceof HTMLInputElement) el.type = o.type
    if (o.href && el instanceof HTMLAnchorElement) el.href = o.href;
    if (o.alt !== undefined && el instanceof HTMLImageElement) el.alt = o.alt;
    if (typeof o?.class == "string") el.classList.add(o.class)
    if (typeof o?.class == "object") el.classList.add(...o.class)
    if (o.aria_modal) el.ariaModal = "true"
    if (o.aria_popup) el.ariaHasPopup = o.aria_popup
    if (o.aria_label) el.ariaLabel = o.aria_label
    if (o.aria_live) el.ariaLive = o.aria_live
    if (o.src && el instanceof HTMLImageElement) el.src = o.src;
    if (o.hidden) el.hidden = o.hidden;
    if (o.icon) {
        el.prepend(e("img", { src: `/assets/icons/${o.icon}.svg`, alt: "", class: "icon" }))
    }
}

export function e<K extends keyof HTMLElementTagNameMap>(name: K, opts: Opts<HTMLElementTagNameMap[K]>, ...children: (HTMLElement | string)[]): HTMLElementTagNameMap[K] {
    const el = document.createElement(name)
    apply_opts(el, opts)
    for (const c of children) el.append(c);
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

export function array_swap<T>(arr: T[], a: number, b: number) {
    const temp = arr[a]
    arr[a] = arr[b]
    arr[b] = temp
}
