// deno-lint-ignore-file no-explicit-any
/// <reference lib="deno.worker" />
import { LOCALES } from "../source/locale/mod.ts";

const global_lc = "en"

function traverse_object(target: any, current: any): any {
    if (typeof target == "string") return target
    if (typeof target == "function") return undefined
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
    if (lc.search("-") != -1) continue
    const k = traverse_object(master, LOCALES[lc]);
    if (JSON.stringify(k).length <= 2) continue
    console.log(JSON.stringify({ source: global_lc, target: lc, strings: k }));
}
