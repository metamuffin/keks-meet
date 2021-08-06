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
export async function rnnoise_track(track: MediaStreamTrack): Promise<MediaStreamTrack> {
    log("misc", "rnnoise enabled")
    const context = new AudioContext()
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
    const source_stream = new MediaStream()
    source_stream.addTrack(track)
    const source = context.createMediaStreamSource(source_stream)
    const destination = context.createMediaStreamDestination()
    const rnnoise = new RNNoiseNode(context)
    source.connect(rnnoise)
    rnnoise.connect(destination)

    return destination.stream.getAudioTracks()[0]
}