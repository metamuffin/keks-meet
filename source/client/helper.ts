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

