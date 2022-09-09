/// <reference lib="dom" />

const log_tag_color = {
    "*": "#ff4a7c",
    crypto: "#c14aff",
    webrtc: "#ff4ade",
    ws: "#544aff",
    media: "#4af5ff",
    rnnoise: "#4aff7e",
    usermodel: "#a6ff4a",
    error: "#FF0000",
}

export type LogTag = keyof typeof log_tag_color

let logger_container: HTMLDivElement

// TODO maybe log time aswell
// deno-lint-ignore no-explicit-any
export function log(tag: LogTag, message: string, ...data: any[]) {
    for (let i = 0; i < data.length; i++) {
        const e = data[i];
        if (e instanceof MediaStreamTrack) data[i] = `(${e.kind}) ${e.id}`
    }
    console.log(`%c[${tag}] ${message}`, "color:" + log_tag_color[tag], ...data);

    if (logger_container) {
        const e = document.createElement("p")
        e.classList.add("logger-line")
        e.textContent = `[${tag}] ${message}`
        e.style.color = log_tag_color[tag]
        logger_container.append(e)
        setTimeout(() => {
            e.remove()
        }, tag == "error" ? 60000 : 6000)
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
    log("error", `${err?.name} ${err?.message}`, err)
    log("error", `on ${source}:${line}:${col}`, err)
}