import { e } from "./helper.ts";
import { PREFS, change_pref } from "./preferences/mod.ts";
import { crypto_hash } from "./protocol/crypto.ts";
import { SignalingConnection } from "./protocol/mod.ts";

interface Watch {
    secret: string,
    hash: string,
    name: string,
    user_count: number,
}

export function ui_room_watches(conn: SignalingConnection): HTMLElement {
    const listing = e("div", { class: "room-watches-listing" })

    const watches: Watch[] = []
    const update_watches = () => (conn.send_control({ watch_rooms: watches.map(w => w.hash) }), update_listing());

    const add_watch = async (secret: string) => watches.push({ name: secret.split("#")[0], secret, hash: await crypto_hash(secret), user_count: 0 })
    const save_watches = () => change_pref("room_watches", JSON.stringify(watches.map(w => w.secret)))
    const load_watches = async () => { for (const secret of JSON.parse(PREFS.room_watches)) { await add_watch(secret) } update_watches() }

    conn.control_handler.add_listener(packet => {
        if (packet.room_info) {
            const w = watches.find(w => w.hash == packet.room_info!.hash)
            w!.user_count = packet.room_info.user_count
            update_listing()
        }
    })

    const update_listing = () => {
        listing.innerHTML = ""
        for (const w of watches) {
            const ucont = []
            if (w.user_count > 0) ucont.push(e("div", {}))
            if (w.user_count > 1) ucont.push(e("div", {}))
            if (w.user_count > 2) ucont.push(e("div", {}))
            if (w.user_count > 3) ucont.push(e("span", {}, `+${w.user_count - 3}`))
            listing.append(e("li", {},
                e("a", {
                    href: "#" + encodeURIComponent(w.secret),
                    class: w.secret == conn.room ? "current-room" : []
                },
                    w.name,
                    e("div", { class: "users" }, ...ucont)
                )
            ))
        }
    }

    load_watches()

    let input: HTMLInputElement;
    return e("div", { class: "room-watches" },
        e("h2", {}, "Known Rooms"),
        listing,
        e("div", { class: "room-watches-edit" },
            e("label", {}, "Add room:", input = e("input", { type: "text" })),
            e("button", {
                async onclick(_e) {
                    await add_watch(input.value)
                    update_watches()
                    save_watches()
                    input.value = ""
                }
            }, "Add")
        )
    )
}
