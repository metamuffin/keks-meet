/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
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
    let RNNoiseNode: typeof RNNoiseNode = globalThis.RNNoiseNode;

    let script: HTMLScriptElement;
    if (!RNNoiseNode) {
        log("rnnoise", "loading wasm...")
        script = document.createElement("script")
        script.src = "/assets/rnnoise/rnnoise-runtime.js"
        script.defer = true
        document.head.appendChild(script)
        //@ts-ignore asdfsfad
        while (!globalThis.RNNoiseNode) await new Promise<void>(r => setTimeout(() => r(), 100))
        //@ts-ignore asfdsadfsafd
        RNNoiseNode = globalThis.RNNoiseNode;
        log("rnnoise", "loaded")
    }

    await RNNoiseNode.register(context)
    return new RNNoiseNode(context)
}