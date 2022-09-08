/// <reference lib="dom" />

import { log } from "./logger.ts"

declare global {
    class RNNoiseNode extends AudioWorkletNode {
        static register(context: AudioContext): Promise<void>
        constructor(context: AudioContext)
        // deno-lint-ignore no-explicit-any
        onstatus: (data: any) => void
        update(something: boolean): void
    }
}


// TODO fix leak
export async function get_rnnoise_node(context: AudioContext): Promise<RNNoiseNode> {
    log("rnnoise", "enabled")
    //@ts-ignore asfdasfd
    let RNNoiseNode: typeof RNNoiseNode = window.RNNoiseNode;

    let script: HTMLScriptElement;
    if (!RNNoiseNode) {
        log("rnnoise", "loading wasm...")
        script = document.createElement("script")
        script.src = "/_assets/rnnoise/rnnoise-runtime.js"
        script.defer = true
        document.head.appendChild(script)
        //@ts-ignore asdfsfad
        while (!window.RNNoiseNode) await new Promise<void>(r => setTimeout(() => r(), 100))
        //@ts-ignore asfdsadfsafd
        RNNoiseNode = window.RNNoiseNode;
        log("rnnoise", "loaded")
    }

    await RNNoiseNode.register(context)
    return new RNNoiseNode(context)
}