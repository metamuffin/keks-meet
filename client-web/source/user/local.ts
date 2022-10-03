/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
/// <reference lib="dom" />

import { log } from "../logger.ts";
import { RemoteUser } from "./remote.ts";
import { Room } from "../room.ts";
import { ChatMessage, ProvideInfo } from "../../../common/packets.d.ts";
import { User } from "./mod.ts";
import { create_camera_res, create_mic_res, create_screencast_res } from "../resource/track.ts";
import { LocalResource } from "../resource/mod.ts";
import { PREFS } from "../preferences/mod.ts";
import { ebutton } from "../helper.ts";

export class LocalUser extends User {
    resources: Map<string, LocalResource> = new Map()

    constructor(room: Room, id: number) {
        super(room, id)
        this.el.classList.add("local")
        this.name = PREFS.username
        log("usermodel", `added local user: ${this.display_name}`)
        this.add_initial_tracks()
    }
    leave() { throw new Error("local users cant leave"); }

    add_initial_tracks() {
        if (PREFS.microphone_enabled) this.await_add_resource(create_mic_res())
        if (PREFS.camera_enabled) this.await_add_resource(create_camera_res())
        if (PREFS.screencast_enabled) this.await_add_resource(create_screencast_res())
    }

    provide_initial_to_remote(u: RemoteUser) {
        this.resources.forEach(r => {
            this.room.signaling.send_relay({ provide: r.info }, u.id)
        })
    }

    identify(recipient?: number) {
        if (this.name) this.room.signaling.send_relay({ identify: { username: this.name } }, recipient)
    }

    chat(message: ChatMessage) {
        this.room.signaling.send_relay({ chat: message })
    }

    async await_add_resource(tp: Promise<LocalResource>) {
        log("media", "awaiting local resource")
        let t!: LocalResource;
        try { t = await tp }
        catch (e) { log("media", `failed ${e.toString()}`) }
        if (!t) return
        log("media", "ok")
        this.add_resource(t)
    }

    add_resource(r: LocalResource) {
        this.resources.set(r.info.id, r)
        this.el.append(r.el)
        const provide: ProvideInfo = r.info
        this.room.signaling.send_relay({ provide })

        r.el.append(
            ebutton("Stop", {
                onclick: () => {
                    r.destroy()
                    this.el.removeChild(r.el);
                    this.room.signaling.send_relay({ provide_stop: { id: r.info.id } })
                }
            }),

        )
    }
}
