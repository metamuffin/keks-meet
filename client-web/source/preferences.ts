import { hex_id } from "./helper.ts";

export interface PrefDecl<T> {
    name: string,
    default: T,
    type?: Type,
    description: string,
    possible_values?: T[]
    optional?: boolean,
}

type Type = "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function";

type PrefMap<T extends { [key: string]: { default: unknown } }> = { [Key in keyof T]: T[Key]["default"] }
export function register_prefs<T extends Record<string, PrefDecl<unknown>>>(ds: T): PrefMap<T> {
    const p: PrefMap<T> = {} as PrefMap<T>
    for (const key in ds) {
        const d = ds[key];
        let type = typeof d.default;
        if (type == "undefined") { if (d.type) type = d.type; else throw new Error("type needed"); }
        let value = get_param(type, d.name) ?? d.default;
        if (d.possible_values) if (!d.possible_values.includes(value)) value = d.default
        p[key] = value
    }
    return p
}

const raw_params = load_query_params();
export function load_query_params(): { [key: string]: string } {
    const q: { [key: string]: string } = {}
    for (const kv of window.location.hash.substring(1).split("&")) {
        const [key, value] = kv.split("=")
        if (key == "prototype") continue
        q[decodeURIComponent(key)] = decodeURIComponent(value)
    }
    return q
}

export function get_param<T>(ty: string, key: string): T | undefined {
    const v = raw_params[key]
    if (v == undefined) return undefined
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
    return undefined
}

const PREF_DECLS = {
    rnnoise: { name: "rnnoise", default: true, description: "Use RNNoise for noise suppression" },
    native_noise_suppression: { name: "native_noise_suppression", default: false, description: "Suggest the browser to do noise suppression" },
    username: { name: "username", default: "guest-" + hex_id(), description: "Username" },
    microphone_gain: { name: "microphone_gain", default: 1, description: "Amplify microphone volume" },
    microphone_enabled: { name: "microphone_enabled", default: false, description: "Add one microphone track on startup" },
    camera_enabled: { name: "camera_enabled", default: false, description: "Add one camera track on startup" },
    screencast_enabled: { name: "screencast_enabled", default: false, description: "Add one screencast track on startup" },
    camera_facing_mode: { name: "camera_facing_mode", default: undefined as undefined | string, type: "string" as const, possible_values: ["environment", "user", undefined], description: "Prefer user-facing or env-facing camera" }
}
export const PREFS = register_prefs(PREF_DECLS)
