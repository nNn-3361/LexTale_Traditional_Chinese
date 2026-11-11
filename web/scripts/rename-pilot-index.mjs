// Renames dist-pilot/pilot.html to index.html, so the site root opens the pilot page.
import { renameSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "dist-pilot");
renameSync(join(dist, "pilot.html"), join(dist, "index.html"));
