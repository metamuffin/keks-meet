
export type LogTag = "webrtc" | "ws" | "media" | "*"
const log_tag_color: { [key in LogTag]: string } = {
    "*": "#FF0000",
    webrtc: "#990099",
    media: "#999900",
    ws: "#009999"
}

// TODO maybe log time aswell
export function log(tag: LogTag, message: string, ...data: any[]) {
    for (let i = 0; i < data.length; i++) {
        const e = data[i];
        if (e instanceof MediaStreamTrack) data[i] = `(${e.kind}) ${e.id}`
    }
    console.log(`%c[${tag}] ${message}`, "color:" + log_tag_color[tag], ...data);
}


