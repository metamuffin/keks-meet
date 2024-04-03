// deno-lint-ignore-file no-explicit-any
import { LOCALES } from "../source/locale/mod.ts";

const global_lc = "en-US"

function traverse_object(target: any, current: any): any {
    if (typeof target == "string") return target
    const out = {} as any
    for (const key in target) {
        if (!current) {
            out[key] = target[key]
        } else {
            if (key in current) continue
            out[key] = traverse_object(target[key], current)
        }
    }
    return out
}

const master = LOCALES[global_lc]
for (const lc in LOCALES) {
    if (lc == global_lc) continue
    const k = JSON.stringify(traverse_object(master, LOCALES[lc]));
    if (k.length <= 2) continue
    console.log(
        `New strings required in ${lc}:\n\t${k}`
    );
}
