
// `emit` uses fetch to *download* was, that is just stupid
// import { bundle } from "https://deno.land/x/emit@0.1.1/mod.ts";

// instead, lets run `deno bundle` manually

async function bundle(entry: string, options: { compilerOptions: { checkJs: boolean } }) {
    const proc = Deno.run({ cmd: ["deno", "bundle", options.compilerOptions.checkJs ? "--check" : "--no-check", "--unstable", entry], stdout: "piped" })
    const out = await proc.output()
    const code = new TextDecoder().decode(out)
    return { code }
}

let refresh_needed = false
let refresh_pending = false
async function refresh() {
    refresh_needed = true
    if (refresh_pending) return
    refresh_needed = false
    refresh_pending = true

    try {
        const { code } = await bundle("source/index.ts", { compilerOptions: { checkJs: false } })
        await Deno.writeTextFile("public/assets/bundle.js", code)
    } catch (e) { console.error(e) }

    refresh_pending = false
    if (refresh_needed) refresh()
}

refresh()
for await (const event of Deno.watchFs("source")) {
    if (event.kind == "modify" || event.kind == "create") {
        refresh()
    }
}
