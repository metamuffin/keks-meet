import { e } from "./helper.ts";

export function ui_room_watches(): HTMLElement {
    const listing = e("div", {})

    return e("div", { class: "room-watches" },
        e("h2", {}, "Known Rooms"),
        listing
    )
}
