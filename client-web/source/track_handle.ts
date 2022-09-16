/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
/// <reference lib="dom" />

export class TrackHandle extends EventTarget {
    stream: MediaStream // this is used to create an id that is persistent across clients

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

        this.stream = new MediaStream([track])
    }

    get kind() { return this.track.kind }
    get label() { return this.track.label }
    get muted() { return this.track.muted }
    get id() { return this.stream.id } //!!

    end() { this.track.stop(); this.dispatchEvent(new CustomEvent("ended")) }
}
