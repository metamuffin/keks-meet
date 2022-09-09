/// <reference lib="dom" />

const log_scope_color = {
    "*": "#ff4a7c",
    crypto: "#c14aff",
    webrtc: "#ff4ade",
    ws: "#544aff",
    media: "#4af5ff",
    rnnoise: "#4aff7e",
    usermodel: "#a6ff4a",
}

export type LogScope = keyof typeof log_scope_color
export interface LogDesc { scope: LogScope, error?: boolean, warn?: boolean }

let logger_container: HTMLDivElement


export function log(k: LogScope | LogDesc, message: string, ...data: unknown[]) {
    for (let i = 0; i < data.length; i++) {
        const e = data[i];
        if (e instanceof MediaStreamTrack) data[i] = `(${e.kind}) ${e.id}`
    }
    let d: LogDesc
    if (typeof k == "string") d = { scope: k }
    else d = k;

    (d.error ? console.error : d.warn ? console.warn : console.log)(`%c[${d.scope}] ${message}`, `color:${log_scope_color[d.scope]}`, ...data);

    if (logger_container) {
        const e = document.createElement("p")
        e.classList.add("logger-line")
        if (d.error) e.classList.add("logger-error")
        else if (d.warn) e.classList.add("logger-warn")
        else e.style.color = log_scope_color[d.scope]
        e.textContent = `[${d.scope}] ${message}`
        logger_container.append(e)
        setTimeout(() => {
            e.classList.add("logger-line-disappear")
            setTimeout(() => {
                e.remove()
            }, 1000 + 500)
        }, (d.error || d.warn) ? 20000 : 3000)
    }
}

globalThis.addEventListener("load", () => {
    const d = document.createElement("div")
    d.classList.add("logger-container")
    document.body.append(d)
    logger_container = d

    // clear the console every hour so logs dont accumulate
    setInterval(() => console.clear(), 1000 * 60 * 60)
})

globalThis.onerror = (_ev, source, line, col, err) => {
    log({ scope: "*", error: true }, `${err?.name} ${err?.message}`, err)
    log({ scope: "*", error: true }, `on ${source}:${line}:${col}`, err)
}