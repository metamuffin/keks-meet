/// <reference lib="dom" />

export type LogTag = "webrtc" | "ws" | "media" | "*" | "misc"
const log_tag_color: { [key in LogTag]: string } = {
    "*": "#FF0000",
    webrtc: "#FF00FF",
    media: "#FFFF00",
    ws: "#00FFFF",
    misc: "#2222FF",
}

// TODO maybe log time aswell
// deno-lint-ignore no-explicit-any
export function log(tag: LogTag, message: string, ...data: any[]) {
    for (let i = 0; i < data.length; i++) {
        const e = data[i];
        if (e instanceof MediaStreamTrack) data[i] = `(${e.kind}) ${e.id}`
    }
    console.log(`%c[${tag}] ${message}`, "color:" + log_tag_color[tag], ...data);
}
