import { TrackHandle } from "../track_handle.ts";
import { Resource } from "./mod.ts";

export class FileResource extends Resource {
    
    on_track(_track: TrackHandle): HTMLElement {
        throw new Error("Method not implemented.");
    }


}
