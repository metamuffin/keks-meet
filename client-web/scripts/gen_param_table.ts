import { PrefDecl, PREF_DECLS } from "../source/preferences.ts";

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