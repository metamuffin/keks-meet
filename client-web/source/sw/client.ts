/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
/// <reference lib="dom" />

import { log } from "../logger.ts"
import { SWMessage } from "./protocol.ts"

export let SW_ENABLED = false

export async function init_serviceworker() {
    let reg = await globalThis.navigator.serviceWorker.getRegistration()
    if (reg) {
        log("sw", "service worker already installed")
        SW_ENABLED = true
    } else {
        log("sw", "registering service worker")
        await globalThis.navigator.serviceWorker.register("/sw.js", { scope: "/", type: "module" })
        log("sw", "worker installed")
        reg = await globalThis.navigator.serviceWorker.getRegistration();
        if (!reg) throw new Error("we just registered the sw!?");
        SW_ENABLED = !!reg
    }
    start_handler()
    log("sw", "checking for updates")
    send_sw_message({ check_version: true })
}

export async function send_sw_message(message: SWMessage, transfer?: Transferable[]) {
    const reg = await globalThis.navigator.serviceWorker.getRegistration();
    if (!reg) throw new Error("no sw");
    if (!reg.active) throw new Error("no sw");
    if (transfer) reg.active.postMessage(message, transfer)
    else reg.active.postMessage(message, transfer)
}

export async function update_serviceworker() {
    const regs = await globalThis.navigator.serviceWorker.getRegistrations()
    for (const r of regs) await r.unregister()
    log("sw", "cleared all workers")
    setTimeout(() => window.location.reload(), 500)
}

function start_handler() {
    globalThis.navigator.serviceWorker.addEventListener("message", event => {
        const message: SWMessage = event.data;
        if (message.version_info) {
            log("sw", JSON.stringify(message.version_info))
        }
        if (message.updated) {
            log("*", "updated")
        }
    })
}
