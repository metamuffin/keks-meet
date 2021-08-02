import Express, { static as estatic, json } from "express";
import { join } from "path";
import Webpack from "webpack"
import WebpackDevMiddleware from "webpack-dev-middleware"
import { existsSync, readFile, readFileSync } from "fs";
import http from "http"
import https from "https"
import expressWs from "express-ws";
import { CallDocModel } from "../models";

const call_docs: Map<String, CallDocModel> = new Map()


async function main() {
    const app_e = Express();
    const app = expressWs(app_e).app

    const webpackConfig = require('../../webpack.config');
    const compiler = Webpack(webpackConfig)
    const devMiddleware = WebpackDevMiddleware(compiler, {
        publicPath: webpackConfig.output.publicPath
    })
    app.use("/scripts", devMiddleware)

    app.disable("x-powered-by");
    app.use(json());

    app.get("/", (req, res) => {
        res.sendFile(join(__dirname, "../../public/index.html"));
    });

    app.use("/static", estatic(join(__dirname, "../../public")));

    app.get("/favicon.ico", (req, res) => {
        res.sendFile(join(__dirname, "../../public/favicon.ico"));
    });

    app.ws("/offer/:id", (ws, req) => {
        const id = req.params.id
        if (call_docs.get(id)) return ws.close(0, "call already running")
        console.log(`[${id}] offer websocket open`);
        ws.onclose = () => console.log(`[${id}] offer websocket close`);
        const doc: CallDocModel = {
            answered: false,
            offer_candidates: [],
            offer: undefined,
            on_answer: () => { },
            on_answer_candidate: () => { },
            on_offer_candidate: () => { },
        }
        ws.onmessage = ev => {
            const s = JSON.parse(ev.data.toString())
            if (s.offer) {
                console.log(`[${id}] offer`);
                doc.offer = s.offer
                call_docs.set(id, doc)
            }
            if (s.candidate) {
                console.log(`[${id}] offer candidate`);
                if (doc.answered) doc.on_offer_candidate(s.candidate)
                else doc.offer_candidates.push(s.candidate)
            }
        }
        doc.on_answer = answer => ws.send(JSON.stringify({ answer }))
        doc.on_answer_candidate = candidate => ws.send(JSON.stringify({ candidate }))
    })

    app.ws("/answer/:id", (ws, req) => {
        const id = req.params.id
        console.log(`[${id}] answer websocket open`);
        ws.onclose = () => console.log(`[${id}] answer websocket close`);
        const doc = call_docs.get(id)
        if (!doc) return ws.close(0, "call not found")
        if (doc.answered) return ws.close(0, "call already answered")
        ws.onmessage = ev => {
            const s = JSON.parse(ev.data.toString())
            if (s.answer) {
                console.log(`[${id}] answer`);
                doc.on_answer(s.answer)
            }
            if (s.candidate) {
                console.log(`[${id}] answer candidate`);
                doc.on_answer_candidate(s.candidate)
            }
        }
        doc.on_offer_candidate = candidate => ws.send(JSON.stringify({ candidate }))
        // TODO this is evil
        setTimeout(() => {
            ws.send(JSON.stringify({ offer: doc.offer }))
            for (const candidate of doc.offer_candidates) {
                ws.send(JSON.stringify({ candidate }))
            }
            doc.offer_candidates = []
        }, 100)
    })

    app.use((req, res, next) => {
        res.status(404);
        res.send("This is an error page");
    });

    const port = parseInt(process.env.PORT ?? "8080")
    app.listen(port, process.env.HOST ?? "127.0.0.1", () => {
        console.log(`Server listening on 127.0.0.1:${port}`);
    })
}

main();