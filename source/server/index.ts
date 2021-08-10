import Express, { static as estatic, json } from "express";
import { join } from "path";
import Webpack from "webpack"
import WebpackDevMiddleware from "webpack-dev-middleware"
import { existsSync, readFile, readFileSync } from "fs";
import http from "http"
import https from "https"
import expressWs from "express-ws";
import { CSPacket, SCPacket } from "../client/types";
import * as ws from "ws"

type Room = Map<string, ws>
const rooms: Map<string, Room> = new Map()

function ws_send(ws: ws, data: SCPacket) {
    try { ws.send(JSON.stringify(data)) }
    catch (e) { console.warn("i hate express-ws") }
}

async function main() {
    const app_e = Express();
    const app = expressWs(app_e).app

    if (process.env.ENV == "production") {
        console.log("PRODUCTION MODE!!!");
        app.use("/scripts", estatic(join(__dirname, "../../public/dist")))
    } else {
        console.log("DEVELOPMENT MODE!!!");
        const webpackConfig = require('../../webpack.dev');
        const compiler = Webpack(webpackConfig)
        const devMiddleware = WebpackDevMiddleware(compiler, {
            publicPath: webpackConfig.output.publicPath
        })
        app.use("/scripts", devMiddleware)
    }

    app.disable("x-powered-by");
    app.use(json());

    app.get("/", (req, res) => {
        res.sendFile(join(__dirname, "../../public/index.html"));
    });
    app.get("/room/:id", (req, res) => {
        res.sendFile(join(__dirname, "../../public/index.html"));
    });

    app.use("/static", estatic(join(__dirname, "../../public")));

    app.ws("/signaling/:id", (ws, req) => {
        const room_name = req.params.id
        const room: Map<string, ws> = rooms.get(req.params.id) ?? new Map()
        let initialized = false
        let user_name = ""

        const init = (n: string) => {
            if (room.get(n)) return ws.close()
            initialized = true
            user_name = n
            rooms.set(req.params.id, room)
            room.forEach(uws => ws_send(uws, { sender: user_name, join: true }))
            room.forEach((_, uname) => ws_send(ws, { sender: uname, join: true, stable: true }))
            room.set(user_name, ws)
            console.log(`[${room_name}] ${user_name} joined`)
        }
        ws.onclose = () => {
            room.delete(user_name)
            room.forEach(uws => ws_send(uws, { sender: user_name, leave: true }))
            if (room.size == 0) rooms.delete(room_name)
            console.log(`[${room_name}] ${user_name} left`)
        }
        ws.onmessage = ev => {
            const message = ev.data.toString()
            if (!initialized) return init(message)
            let in_packet: CSPacket;
            try { in_packet = JSON.parse(message) }
            catch (e) { return }

            console.log(`[${room_name}] ${user_name} -> ${in_packet.receiver ?? "*"}: ${message.substr(0, 100)}`)
            const out_packet: SCPacket = { sender: user_name, data: in_packet }

            if (in_packet.receiver) {
                const rws = room.get(in_packet.receiver)
                if (rws) ws_send(rws, out_packet)
            } else {
                room.forEach((uws, uname) => {
                    if (uname != user_name) ws_send(uws, out_packet)
                })
            }
        }
    })

    app.use((req, res, next) => {
        res.status(404);
        res.send("This is an error page");
    });

    const port = parseInt(process.env.PORT ?? "8080")
    app.listen(port, process.env.HOST ?? "127.0.0.1", () => {
        console.log(`Server listening on ${process.env.HOST ?? "127.0.0.1"}:${port}`);
    })
}

main();