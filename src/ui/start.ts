/** Entry point: start the wrapper server. `npm run ui` (builds then runs).
 *
 * This is the composition root — the ONE file on the harness side allowed to
 * import src/exam (Plan 006 §2). WORLD_MODE=record|replay + WORLD_DIR wire a
 * frozen world around the providers; unset, everything is live and untouched. */
import { createHarnessServer } from "./server.js";
import { PlaywrightValidator } from "../providers/validation/playwright.js";
import { worldFromEnv } from "../exam/world.js";

const validator = worldFromEnv(new PlaywrightValidator());
const port = Number(process.env.PORT ?? 3000);
createHarnessServer({ validator }).listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`The Harness wrapper listening on http://localhost:${port}`);
});
