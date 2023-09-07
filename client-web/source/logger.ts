/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin@disroot.org>
*/
/// <reference lib="dom" />

import { e } from "./helper.ts";

export const LOGGER_CONTAINER = e("div", { class: "logger-container" })

const log_scope_color = {
    "*": "#ff4a7c",
    crypto: "#c14aff",
    webrtc: "#ff4ade",
    ws: "#544aff",
    media: "#4af5ff",
    rnnoise: "#4aff7e",
    sw: "#4aff7e",
    usermodel: "#a6ff4a",
    dc: "#4af5ff",
}

export type LogScope = keyof typeof log_scope_color
export interface LogDesc { scope: LogScope, error?: boolean, warn?: boolean }

export function log(k: LogScope | LogDesc, message: string, ...data: unknown[]) {
    for (let i = 0; i < data.length; i++) {
        const e = data[i];
        if (e instanceof MediaStreamTrack) data[i] = `(${e.kind}) ${e.id}`
    }
    let d: LogDesc
    if (typeof k == "string") d = { scope: k }
    else d = k;

    (d.error ? console.error : d.warn ? console.warn : console.log)(`%c[${d.scope}] ${message}`, `color:${log_scope_color[d.scope]}`, ...data);

    if (LOGGER_CONTAINER) {
        const e = document.createElement("p")
        e.classList.add("logger-line")
        if (d.error) e.classList.add("logger-error")
        else if (d.warn) e.classList.add("logger-warn")
        else e.style.color = log_scope_color[d.scope]
        e.textContent = `[${d.scope}] ${message}`
        LOGGER_CONTAINER.append(e)
        setTimeout(() => {
            e.classList.add("logger-line-disappear")
            setTimeout(() => {
                e.remove()
            }, 1000 + 500)
        }, (d.error || d.warn) ? 30000 : 3000)
    }
}

globalThis.addEventListener("load", () => {
    // clear the console every hour so logs dont accumulate
    setInterval(() => console.clear(), 1000 * 60 * 60)
})

globalThis.onerror = (_ev, source, line, col, err) => {
    log({ scope: "*", error: true }, `${err?.name} ${err?.message}`, err)
    log({ scope: "*", error: true }, `on ${source}:${line}:${col}`, err)
}