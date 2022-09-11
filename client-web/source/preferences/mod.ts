import { log } from "../logger.ts";
import { PREF_DECLS } from "./decl.ts";


export interface PrefDecl<T> {
    default?: T,
    type: T,
    description?: string,
    possible_values?: T[]
    optional?: boolean,
    hidden?: boolean
    allow_url?: boolean
}

type Type = "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function";
type TypeMapper = { "string": string, "number": number, "boolean": boolean }

type PrefMap<T extends { [key: string]: { type: unknown } }> = { [Key in keyof T]: T[Key]["type"] }
type Optional<T extends { [key: string]: unknown }> = { [Key in keyof T]?: T[Key] }
export const { prefs: PREFS, explicit: PREFS_EXPLICIT } = register_prefs(PREF_DECLS)
const pref_change_handlers: Map<keyof typeof PREFS, Set<() => unknown>> = new Map()
export const on_pref_changed = (key: keyof typeof PREFS, cb: () => unknown): (() => void) => {
    const m = (pref_change_handlers.get(key)
        ?? (() => {
            const n = new Set<() => unknown>();
            pref_change_handlers.set(key, n);
            return n
        })()
    )
    m.add(cb)
    return () => m.delete(cb)
}

export function register_prefs<T extends Record<string, PrefDecl<unknown>>>(ds: T): { prefs: PrefMap<T>, explicit: Optional<PrefMap<T>> } {
    const prefs: PrefMap<T> = {} as PrefMap<T>
    const explicit: Optional<PrefMap<T>> = {}
    for (const key in ds) {
        const d = ds[key];
        const type = typeof d.type;

        let value = get_param(type, key)
        if (value !== undefined && !d.allow_url) setTimeout(() => { // defer log call because this is executed early
            log({ scope: "*", warn: true }, `pref key ${JSON.stringify(key)} is not allowed in url`)
        })
        if (!d.allow_url) value = undefined
        const j = localStorage.getItem(key)
        if (j) value ??= JSON.parse(j) ?? undefined

        if (value !== undefined) explicit[key] = value
        value ??= d.default;
        if (d.possible_values) if (!d.possible_values.includes(value)) value = d.default
        prefs[key] = value
    }
    return { prefs, explicit }
}

window["change_pref" as "onbeforeprint"] = change_pref as () => void // TODO ugly
export function change_pref<T extends keyof typeof PREFS>(key: T, value: typeof PREFS[T]) {
    log("*", `pref changed: ${key}`)
    PREFS[key] = value
    if ((PREF_DECLS as Record<string, PrefDecl<unknown>>)[key].default != value)
        PREFS_EXPLICIT[key] = value
    else delete PREFS_EXPLICIT[key]
    pref_change_handlers.get(key)?.forEach(h => h())
    // window.location.hash = "#" + generate_section()
    localStorage.setItem(key, JSON.stringify(value) ?? null)
}

function param_to_string<T>(p: T): string {
    if (typeof p == "string") return p
    else if (typeof p == "boolean") return JSON.stringify(p)
    else if (typeof p == "number") return JSON.stringify(p)
    throw new Error("impossible");
}

export function generate_section(): string {
    const section = []
    for (const key in PREFS_EXPLICIT) {
        section.push(encodeURIComponent(key) + "=" + encodeURIComponent(param_to_string(
            PREFS_EXPLICIT[key as unknown as keyof typeof PREFS_EXPLICIT]
        )))
    }
    return load_params().rname + "?" + section.join("&")
}

export function load_params(): { raw_params: { [key: string]: string }, rname: string } {
    const raw_params: Record<string, string> = {}
    const [rname, param_str] = window.location.hash.substring(1).split("?")
    if (!param_str) return { rname, raw_params: {} }
    for (const kv of param_str.split("&")) {
        const [key, value] = kv.split("=")
        if (key == "prototype") continue
        raw_params[decodeURIComponent(key)] = decodeURIComponent(value)
    }
    return { raw_params, rname }
}

function get_param<T>(ty: string, key: string): T | undefined {
    const v = load_params().raw_params[key]
    if (v !== undefined) {
        if (ty == "string") return v as unknown as T
        else if (ty == "number") {
            const n = parseInt(v)
            if (!Number.isNaN(n)) return n as unknown as T
            console.warn("invalid number parameter");
        } else if (ty == "boolean") {
            if (v == "0" || v == "false" || v == "no") return false as unknown as T
            if (v == "1" || v == "true" || v == "yes") return true as unknown as T
            console.warn("invalid boolean parameter");
        } else {
            throw new Error("invalid param type");
        }
    }
}
