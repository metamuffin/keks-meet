import { array_swap, e } from "./helper.ts";
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

    let watches: Watch[] = []
    const update_watches = () => (conn.send_control({ watch_rooms: watches.map(w => w.hash) }), update_listing());

    const add_watch = async (secret: string) => watches.push({ name: secret.split("#")[0], secret, hash: await crypto_hash(secret), user_count: 0 })
    const save_watches = () => change_pref("room_watches", JSON.stringify(watches.map(w => w.secret)))
    const load_watches = async () => { for (const secret of JSON.parse(PREFS.room_watches)) { await add_watch(secret) } update_watches() }

    conn.control_handler.add_listener(packet => {
        if (packet.room_info) {
            const w = watches.filter(w => w.hash == packet.room_info!.hash)
            w.forEach(w => w.user_count = packet.room_info!.user_count)
            update_listing()
        }
    })

    let edit = false;

    const update_listing = () => {
        listing.innerHTML = ""
        for (let wi = 0; wi < watches.length; wi++) {
            const w = watches[wi]
            const ucont = []
            if (w.user_count > 0) ucont.push(e("div", {}))
            if (w.user_count > 1) ucont.push(e("div", {}))
            if (w.user_count > 2) ucont.push(e("div", {}))
            if (w.user_count > 3) ucont.push(e("span", {}, `+${w.user_count - 3}`))
            const el = e("li", {}, e("a",
                {
                    href: "#" + w.secret,
                    class: w.secret == conn.room ? "current-room" : []
                },
                w.name,
                e("div", { class: "users" }, ...ucont),
            ))
            if (edit) el.append(e("button", { onclick(_) { watches = watches.filter(e => e != w); update_listing() } }, "X"))
            if (edit && wi > 0) el.append(e("button", { onclick(_) { array_swap(watches, wi, wi - 1); update_listing() } }, "Move up"))
            if (edit && wi < watches.length - 1) el.append(e("button", { onclick(_) { array_swap(watches, wi, wi + 1); update_listing() } }, "Move down"))
            listing.append(el)
        }

        if (edit) {
            let input: HTMLInputElement;
            listing.append(e("li", { class: "room-watches-edit" },
                e("label", {}, "Add room:", input = e("input", { type: "text" })),
                e("button", {
                    async onclick(_e) {
                        for (const w of input.value.split(";"))
                            await add_watch(w)
                        update_watches()
                        input.value = ""
                    }
                }, "Add")
            ))
        }
    }

    load_watches()

    return e("div", { class: "room-watches" },
        e("h2", {}, "Known Rooms"),
        listing,
        e("button", {
            onclick(e) {
                edit = !edit;
                e.textContent = edit ? "Finish edit" : "Edit";
                if (!edit) save_watches(), update_watches()
                update_listing()
            }
        }, "Edit"),
    )
}
