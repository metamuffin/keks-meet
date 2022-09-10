import { ebr, ebutton, ediv, elabel, espan, OverlayUi } from "../helper.ts";
import { PREF_DECLS } from "./decl.ts";
import { change_pref, PrefDecl, PREFS } from "./mod.ts";

export class PrefUi extends OverlayUi {
    constructor() {
        const elements = Object.entries(PREF_DECLS as Record<string, PrefDecl<unknown>>).map(([key_, decl]) => {
            const key = key_ as keyof typeof PREF_DECLS

            if (typeof decl.type == "boolean") {
                const id = `pref-check-${key}`
                const checkbox = document.createElement("input")
                checkbox.type = "checkbox"
                checkbox.id = id
                checkbox.checked = PREFS[key] as boolean
                checkbox.onchange = () => {
                    change_pref(key, checkbox.checked)
                }
                const label = elabel(decl.description ?? `[${key}]`, { id })
                return ediv({ class: "pref" }, checkbox, label)
            }
            return espan(`(not implemented)`)
        })
        const notification_perm = Notification.permission == "granted" ? ediv() : ediv({},
            espan("For keks-meet to send notifications, it needs you to grant permission: "),
            ebutton("Grant", { onclick: () => Notification.requestPermission() }),
        )
        super(ediv({ class: "prefs-overlay" }, notification_perm, ebr(), ...elements))
    }

}