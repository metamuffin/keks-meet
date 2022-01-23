
export class TrackHandle extends EventTarget {
    constructor(public track: MediaStreamTrack) {
        super()
        track.onended = () => this.dispatchEvent(new CustomEvent("ended"))
        track.onmute = () => this.dispatchEvent(new CustomEvent("mute"))
        track.onunmute = () => this.dispatchEvent(new CustomEvent("unmute"))
    }

    get kind() { return this.track.kind }
    get label() { return this.track.label }
    get muted() { return this.track.muted }
    get id() { return this.track.id }
}
