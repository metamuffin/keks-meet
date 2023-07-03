/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2023 metamuffin <metamuffin@disroot.org>
*/
/// <reference lib="dom" />

import { ediv, epre, espan } from "../helper.ts";
import { Room } from "../room.ts";

export class User {
    private _name?: string
    set name(v: string | undefined) { this._name = v; this.name_el.textContent = this.display_name }
    get name() { return this._name }
    get display_name() { return this.name ?? "Unknown" }

    name_el = espan(this.display_name)
    stats_el = epre("")
    el = ediv({ class: "user" })

    constructor(public room: Room, public id: number) {
        const info_el = ediv({ class: "info" })
        this.name_el.textContent = this.display_name
        this.name_el.classList.add("name")
        info_el.append(this.name_el, this.stats_el)
        this.el.append(info_el)
        room.element.append(this.el)
    }
}