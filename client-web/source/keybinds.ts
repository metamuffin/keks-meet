import { Room } from "./room.ts"


export function setup_keybinds(room: Room) {
    let command_mode = false
    document.body.addEventListener("keydown", ev => {
        // TODO is there a proper solution?
        if (ev.target instanceof HTMLInputElement && !(ev.target.type == "button")) return
        if (ev.repeat) return
        if (ev.code == "Enter") {
            room.chat.shown = !room.chat.shown
            if (room.chat.shown) room.chat.focus()
            ev.preventDefault() // so focused buttons dont trigger
        }
        if (ev.code == "Space") {
            command_mode = true
            ev.preventDefault() // so focused buttons dont trigger
            return
        }
        if (command_mode) {
            if (ev.code == "KeyM") room.local_user.publish_track(room.local_user.create_mic_track())
            if (ev.code == "KeyC") room.local_user.publish_track(room.local_user.create_camera_track())
            if (ev.code == "KeyS") room.local_user.publish_track(room.local_user.create_screencast_track())
        }
        command_mode = false
    })
}
