// there should be no deps to dom APIs in this file for the tablegen to work

export function hex_id(len = 8): string {
    if (len > 8) return hex_id() + hex_id(len - 8)
    return Math.floor(Math.random() * 16 ** len).toString(16).padStart(len, "0")
}

// TODO this could be simpler
const string = "", bool = false, number = 0; // example types for ts
export const PREF_DECLS = {
    username: { type: string, default: "guest-" + hex_id(), description: "Username" },
    warn_redirect: { type: bool, default: false, description: "Interal option that is set by a server redirect." },

    /* MEDIA */
    microphone_enabled: { type: bool, default: false, description: "Add one microphone track on startup" },
    screencast_enabled: { type: bool, default: false, description: "Add one screencast track on startup" },
    camera_enabled: { type: bool, default: false, description: "Add one camera track on startup" },
    rnnoise: { type: bool, default: true, description: "Use RNNoise for noise suppression" },
    native_noise_suppression: { type: bool, default: false, description: "Suggest the browser to do noise suppression" },
    microphone_gain: { type: number, default: 1, description: "Amplify microphone volume" },
    video_fps: { type: number, description: "Preferred framerate (in 1/s) for screencast and camera" },
    video_resolution: { type: number, description: "Preferred width for screencast and camera" },
    camera_facing_mode: { type: string, possible_values: ["environment", "user"], description: "Prefer user-facing or env-facing camera" },
    auto_gain_control: { type: bool, description: "Automatically adjust mic gain" },
    echo_cancellation: { type: bool, description: "Cancel echo" },
}

export interface PrefDecl<T> {
    default?: T,
    type: T,
    description?: string,
    possible_values?: T[]
    optional?: boolean,
}

type Type = "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function";
type TypeMapper = { "string": string, "number": number, "boolean": boolean }

type PrefMap<T extends { [key: string]: { type: unknown } }> = { [Key in keyof T]: T[Key]["type"] }
export function register_prefs<T extends Record<string, PrefDecl<unknown>>>(ds: T): PrefMap<T> {
    const p: PrefMap<T> = {} as PrefMap<T>
    for (const key in ds) {
        const d = ds[key];
        const type = typeof d.type;
        let value = get_param(type, key) ?? d.default;
        if (d.possible_values) if (!d.possible_values.includes(value)) value = d.default
        p[key] = value
    }
    return p
}

const raw_params = globalThis.Deno ? {} : load_params().p;
export function load_params(): { p: { [key: string]: string }, rname: string } {
    const q: Record<string, string> = {}
    const [rname, params] = window.location.hash.substring(1).split("?")
    if (!params) return { rname, p: {} }
    for (const kv of params.split("&")) {
        const [key, value] = kv.split("=")
        if (key == "prototype") continue
        q[decodeURIComponent(key)] = decodeURIComponent(value)
    }
    return { p: q, rname }
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

export const PREFS = register_prefs(PREF_DECLS)
