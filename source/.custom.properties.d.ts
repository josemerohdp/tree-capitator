import { Dimension } from "@minecraft/server";

declare module "@minecraft/server" {
    interface World {
        getDimensions(): Dimension[];
    }
}
