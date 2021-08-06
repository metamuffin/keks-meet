import { parameters } from "."

export function get_query_params(): { [key: string]: string } {
    const q: { [key: string]: string } = {}
    for (const kv of window.location.search.substr(1).split("&")) {
        const [key, value] = kv.split("=")
        q[decodeURIComponent(key)] = decodeURIComponent(value)
    }
    return q
}

export function hex_id(len: number = 8): string {
    if (len > 8) return hex_id() + hex_id(len - 8)
    return Math.floor(Math.random() * 16 ** len).toString(16).padStart(len, "0")
}


export function parameter_bool(name: string, def: boolean): boolean {
    const v = parameters[name]
    if (!v) return def
    if (v == "0" || v == "false" || v == "no") return false
    if (v == "1" || v == "true" || v == "yes") return true
    alert(`parameter ${name} is invalid`)
    return  def
}

export function parameter_number(name: string, def: number): number {
    const v = parameters[name]
    if (!v) return def
    const n = parseFloat(v)
    if (Number.isNaN(n)) {
        alert(`parameter ${name} is invalid`)
        return def
    }
    return n
}

export function parameter_string(name: string, def: string): string {
    const v = parameters[name]
    if (!v) return def
    return v
}

