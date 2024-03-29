/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
/// <reference lib="dom" />

import { e } from "../helper.ts";
import { PREF_DECLS } from "./decl.ts";
import { change_pref, on_pref_changed, PrefDecl, PREFS } from "./mod.ts";

export function ui_preferences(): HTMLElement {
    const rows = Object.entries(PREF_DECLS as Record<string, PrefDecl<unknown>>).filter(e => !e[1].hidden).map(([key_, decl]) => {
        const key = key_ as keyof typeof PREF_DECLS
        const id = `pref-${key}`
        let prim_control: HTMLInputElement | HTMLSelectElement | undefined;
        if (decl.possible_values) {
            const sel = document.createElement("select")
            sel.id = id
            sel.value = JSON.stringify(PREFS[key])
            for (const v of decl.possible_values) {
                const opt = document.createElement("option")
                opt.value = opt.textContent = JSON.stringify(v ?? null)
                sel.append(opt)
            }
            sel.onchange = () => {
                change_pref(key, JSON.parse(sel.value) ?? undefined)
            }
            on_pref_changed(key, () => sel.value = JSON.stringify(PREFS[key] ?? null))
            prim_control = sel
        } else if (typeof decl.type == "boolean") {
            const checkbox = document.createElement("input")
            checkbox.type = "checkbox"
            checkbox.id = id
            checkbox.checked = PREFS[key] as boolean
            checkbox.onchange = () => {
                change_pref(key, checkbox.checked)
            }
            on_pref_changed(key, () => checkbox.checked = PREFS[key] as boolean)
            prim_control = checkbox
        } else if (typeof decl.type == "string") {
            const textbox = document.createElement("input")
            textbox.type = "text"
            textbox.id = id
            textbox.value = PREFS[key] as string
            textbox.onchange = () => {
                change_pref(key, textbox.value)
            }
            on_pref_changed(key, () => textbox.value = PREFS[key] as string)
            prim_control = textbox
        } else if (typeof decl.type == "number") {
            const textbox = document.createElement("input")
            textbox.type = "number"
            textbox.id = id
            textbox.value = PREFS[key] as string
            textbox.onchange = () => {
                change_pref(key, parseFloat(textbox.value))
            }
            on_pref_changed(key, () => textbox.value = PREFS[key] as string)
            prim_control = textbox
        }

        let use_opt_;
        if (decl.default === undefined || decl.optional) {
            const use_opt = document.createElement("input")
            use_opt.type = "checkbox"
            use_opt.id = "enable-" + id
            use_opt.checked = PREFS[key] !== undefined
            if (prim_control) prim_control.disabled = !use_opt.checked
            use_opt.onchange = () => {
                if (use_opt.checked) { if (prim_control?.onchange) prim_control.onchange(new Event("change")) }
                else change_pref(key, undefined)
            }
            on_pref_changed(key, () => {
                use_opt.checked = PREFS[key] !== undefined
                if (prim_control) prim_control.disabled = !use_opt.checked
            })
            use_opt_ = use_opt;
        }

        const label = e("label", { for: id }, decl.description ?? `[${key}]`)
        return e("tr", { class: "pref" }, e("td", {}, label), e("td", {}, use_opt_ ?? ""), e("td", {}, prim_control ?? ""))
    })

    const notification_perm = Notification.permission == "granted" ? e("div", {}) : e("div", {},
        e("span", {}, "For keks-meet to send notifications, it needs you to grant permission: "),
        e("button", { onclick: () => Notification.requestPermission() }, "Grant"),
    )
    const reset = e("div", {},
        e("span", {}, "Want to clear all settings? Use this:"),
        e("button", { onclick: () => { if (confirm("really clear all preferences?")) { localStorage.clear(); window.location.reload() } } }, "RESET"),
    )

    const table = document.createElement("table")
    table.append(...rows)

    return e("div", { class: "preferences" },
        e("h2", {}, "Settings"),
        notification_perm, e("br", {}),
        table, e("br", {}),
        reset
    )
}
