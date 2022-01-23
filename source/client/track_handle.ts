
export class TrackHandle extends EventTarget {
    constructor(
        public track: MediaStreamTrack,
        public local = false
    ) {
        super()
        track.onended = () => this.dispatchEvent(new CustomEvent("ended"))
        // TODO research how onmute and onunmute behave
        track.onmute = () => this.dispatchEvent(new CustomEvent("ended")) // onmute seems to be called when the remote ends the track
        track.onunmute = () => this.dispatchEvent(new CustomEvent("started"))

        this.addEventListener("ended", () => {
            // drop all references to help gc
            track.onunmute = track.onmute = track.onended = null
        })
    }

    get kind() { return this.track.kind }
    get label() { return this.track.label }
    get muted() { return this.track.muted }
    get id() { return this.track.id }

    end() { this.track.stop(); this.dispatchEvent(new CustomEvent("ended")) }
}
