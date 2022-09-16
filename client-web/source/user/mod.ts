/// <reference lib="dom" />

import { epre, espan } from "../helper.ts";
import { ROOM_CONTAINER } from "../index.ts";
import { Resource } from "../resource/mod.ts";
import { Room } from "../room.ts"

export abstract class User {
    public el: HTMLElement
    public local = false
    public resources: Map<string, Resource> = new Map()

    private name_el = espan("")
    protected stats_el = epre("", { class: "stats" })
    private _name?: string
    get name() { return this._name }
    set name(n: string | undefined) { this._name = n; this.name_el.textContent = this.display_name }
    get display_name() { return this.name ?? `unknown (${this.id})` }

    constructor(public room: Room, public id: number) {
        room.users.set(this.id, this)

        this.el = document.createElement("div")
        this.el.classList.add("user")
        ROOM_CONTAINER.append(this.el)
        this.setup_view()
    }
    leave() {
        this.room.users.delete(this.id)
    }

    setup_view() {
        const info_el = document.createElement("div")
        info_el.classList.add("info")
        this.name_el.textContent = this.display_name
        this.name_el.classList.add("name")
        info_el.append(this.name_el, this.stats_el)
        this.el.append(info_el)
    }
}