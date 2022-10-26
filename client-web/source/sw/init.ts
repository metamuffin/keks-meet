/*
    This file is part of keks-meet (https://codeberg.org/metamuffin/keks-meet)
    which is licensed under the GNU Affero General Public License (version 3); see /COPYING.
    Copyright (C) 2022 metamuffin <metamuffin@disroot.org>
*/
/// <reference lib="dom" />

import { log } from "../logger.ts"

export let SW: ServiceWorker | undefined
export async function init_serviceworker() {
    let reg = await globalThis.navigator.serviceWorker.getRegistration()
    if (reg) {
        log("sw", "service worker already installed")
    } else {
        log("sw", "registering service worker")
        await globalThis.navigator.serviceWorker.register("/sw.js", { scope: "/", type: "module" })
        log("sw", "worker installed")
        reg = await globalThis.navigator.serviceWorker.getRegistration();
        if (!reg) throw new Error("we just registered the sw!?");
    }
    const i = setInterval(() => {
        if (reg!.active) {
            SW = reg!.active
            clearInterval(i)
        }
    }, 100)
}

export async function update_serviceworker() {
    const regs = await globalThis.navigator.serviceWorker.getRegistrations()
    for (const r of regs) await r.unregister()
    log("sw", "cleared all workers")
    setTimeout(() => window.location.reload(), 500)
}
