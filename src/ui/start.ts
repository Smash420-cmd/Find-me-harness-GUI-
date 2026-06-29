/** Entry point: start the wrapper server. `npm run ui` (builds then runs). */
import { createHarnessServer } from "./server.js";

const port = Number(process.env.PORT ?? 3000);
createHarnessServer().listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`The Harness wrapper listening on http://localhost:${port}`);
});
