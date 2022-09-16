/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
import { PREF_DECLS } from "../source/preferences/decl.ts";
import { PrefDecl } from "../source/preferences/mod.ts";

console.log(`Option name|Type|Default|Description`);
console.log(`---|---|---|---`);

const P = PREF_DECLS as Record<string, PrefDecl<unknown>>
for (const key in P) {
    const e = P[key];
    if (key == "username") e.default = "guest-…" // maybe generalize
    const q = (e: string) => `\`${e}\``
    console.log([
        q(key),
        typeof e.type,
        e.default === undefined ? "-" : q(JSON.stringify(e.default)),
        (e.description ?? "*none*") + (
            e.possible_values
                ? " (" + e.possible_values.map(e => JSON.stringify(e)).map(q).join(" / ") + ")"
                : ""
        )
    ].join("|"));
}