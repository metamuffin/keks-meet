/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin.org>
*/
/// <reference lib="dom" />

import { chat_control } from "./menu.ts";
import { create_camera_res, create_mic_res, create_screencast_res } from "./resource/track.ts";
import { Room } from "./room.ts"
import { update_serviceworker } from "./sw/client.ts";

export function setup_keybinds(room: Room) {
    document.body.addEventListener("keydown", ev => {
        // TODO is there a proper solution?
        if (ev.target instanceof HTMLInputElement && !(ev.target.type == "button")) return
        if (ev.repeat) return
        if (ev.code == "Enter" && ev.ctrlKey) {
            chat_control()
            ev.preventDefault() // so focused buttons dont trigger
        }
        if (ev.shiftKey) {
            if (ev.code == "KeyM" || ev.code == "KeyR") room.local_user.await_add_resource(create_mic_res())
            if (ev.code == "KeyS") room.local_user.await_add_resource(create_screencast_res())
            if (ev.code == "KeyC" && !ev.ctrlKey) room.local_user.await_add_resource(create_camera_res())
            if (ev.code == "KeyC" && ev.ctrlKey) room.local_user.resources.forEach(t => t.destroy())
            if (ev.code == "KeyU") if (window.confirm("really update?")) update_serviceworker()
        }
    })
}
