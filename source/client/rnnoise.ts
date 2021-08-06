import { log } from "./logger"

declare global {
    class RNNoiseNode extends AudioWorkletNode {
        static register(context: AudioContext): Promise<void>
        constructor(context: AudioContext)
        onstatus: (data: any) => void
        update(something: boolean): void
    }
}


// TODO fix leak
export async function get_rnnoise_node(context: AudioContext): Promise<RNNoiseNode> {
    log("misc", "rnnoise enabled")
    //@ts-ignore
    let RNNoiseNode: typeof RNNoiseNode = window.RNNoiseNode;

    let script: HTMLScriptElement;
    if (!RNNoiseNode) {
        log("misc", "loading rnnoise...")
        script = document.createElement("script")
        script.src = "/static/rnnoise/rnnoise-runtime.js"
        script.defer = true
        document.head.appendChild(script)
        //@ts-ignore
        while (!window.RNNoiseNode) await new Promise<void>(r => setTimeout(() => r(), 100))
        //@ts-ignore
        RNNoiseNode = window.RNNoiseNode;
        log("misc", "rnnoise loaded")
    }

    await RNNoiseNode.register(context)
    return new RNNoiseNode(context)
}