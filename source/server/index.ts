import { Application, Router, RouterContext, send } from "https://deno.land/x/oak/mod.ts";
import { api } from "./room.ts";

const app = new Application()

const root = new Router()

let bundleFiles: Record<string, string> = {}

root.get("/", async c => { await c.send({ path: "index.html", root: `${Deno.cwd()}/public` }) })
root.get("/room/:id", async c => { await c.send({ path: "index.html", root: `${Deno.cwd()}/public` }) })

root.get("/favicon.ico", c => { c.response.status = 204 })

// deno-lint-ignore no-explicit-any
function respondWithType(mimeType: string, f: () => string): (c: RouterContext<any, any, any>) => void {
    return c => {
        c.response.headers.set("Content-Type", mimeType)
        c.response.body = f()
    }
}

root.get("/bundle.js", respondWithType("application/javascript", () => bundleFiles["deno:///bundle.js"]))
root.get("/bundle.js.map", respondWithType("application/javascript", () => bundleFiles["deno:///bundle.js.map"]))

function mountFilesystem(r: Router, route: string, path: string) {
    r.get(route + "/(.*)", async (context) => {
        await send(context, context.request.url.pathname, { root: Deno.cwd() + path });
    })

}

mountFilesystem(root, "/style", "/public")
mountFilesystem(root, "/rnnoise", "/public")

root.use(api.routes())

app.use(root.routes())
app.use(root.allowedMethods())

app.addEventListener("listen", ({ hostname, port, secure }) => {
    console.log(`listening on: ${secure ? "https://" : "http://"}${hostname}:${port}`);
});

app.listen({
    hostname: Deno.env.get("HOSTNAME") ?? "127.0.0.1",
    port: parseInt(Deno.env.get("PORT") ?? "8080")
});


let refresh_needed = false
let refresh_pending = false
async function refresh() {
    refresh_needed = true
    if (refresh_pending) return
    refresh_needed = false
    refresh_pending = true

    try {
        const { files } = await Deno.emit("source/client/index.ts", { bundle: "module", check: false })
        bundleFiles = files
    } catch (e) { console.error(e) }

    refresh_pending = false
    if (refresh_needed) refresh()
}

refresh()
for await (const event of Deno.watchFs("source/client")) {
    if (event.kind == "modify" || event.kind == "create") {
        refresh()
    }
}
