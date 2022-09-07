import { Application, Router, RouterContext, send } from "https://deno.land/x/oak@v10.4.0/mod.ts";
import { api } from "./room.ts";
import { bundle } from "https://deno.land/x/emit@0.1.1/mod.ts";

const app = new Application()
const root = new Router()


root.get("/", async c => { await c.send({ path: "index.html", root: `${Deno.cwd()}/public` }) })
root.get("/room/:id", async c => { await c.send({ path: "index.html", root: `${Deno.cwd()}/public` }) })

root.get("/licen(c|s)e", async c => {
    c.response.body = await Deno.readTextFile("LICENCE")
    c.response.headers.set("Content-Type", "text/plain")
})

root.get("/favicon.ico", c => { c.response.status = 204 })

// deno-lint-ignore no-explicit-any
function respondWithType(mimeType: string, f: () => string): (c: RouterContext<any, any, any>) => void {
    return c => {
        c.response.headers.set("Content-Type", mimeType)
        c.response.body = f()
    }
}

let bundle_code = ""
root.get("/bundle.js", respondWithType("application/javascript", () => bundle_code))

root.use(api.routes())

function mountFilesystem(r: Router, route: string, path: string) {
    r.get(route + "/(.*)", async (context) => {
        console.log(context.request.url.pathname.substring(route.length));
        await send(context, context.request.url.pathname.substring(route.length), { root: Deno.cwd() + path });
    })
}

mountFilesystem(root, "/_style", "/public/style")
mountFilesystem(root, "/_rnnoise", "/public/rnnoise")

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
        const { code } = await bundle("source/client/index.ts", { compilerOptions: { checkJs: false } })
        bundle_code = code
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
