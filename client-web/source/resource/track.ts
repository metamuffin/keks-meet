/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
/// <reference lib="dom" />

import { ProvideInfo } from "../../../common/packets.d.ts";
import { TrackHandle } from "../track_handle.ts";
import { User } from "../user/mod.ts";
import { Resource } from "./mod.ts";

export class TrackResource extends Resource {
    constructor(user: User, info: ProvideInfo, track?: TrackHandle) {
        super(user, info)
        this.track = track
    }

    destroy() {
        this.track?.end()
        super.destroy()
    }

    on_track(track: TrackHandle): HTMLElement {
        const el = document.createElement("div")
        const is_video = track.kind == "video"
        const media_el = is_video ? document.createElement("video") : document.createElement("audio")
        const stream = new MediaStream([track.track])
        media_el.srcObject = stream
        media_el.classList.add("media")
        media_el.autoplay = true
        media_el.controls = true
        if (track.local) media_el.muted = true
        el.append(media_el)

        if (track.local) {
            const end_button = document.createElement("button")
            end_button.textContent = "End"
            end_button.addEventListener("click", () => {
                track?.end()
            })
            el.append(end_button)
        }
        this.el.append(el)
        track.addEventListener("ended", () => {
            media_el.srcObject = null // TODO
            el.remove()
        })
        return el
    }
}