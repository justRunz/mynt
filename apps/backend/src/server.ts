import { createApp } from "./app.js";
import { closeDb } from "./db/index.js";
import { env } from "./env.js";

const server = createApp().listen(env.port, env.host, () => {
    console.log(`API sur http://${env.host}:${env.port}`);
});

/**
 * Leaving without dropping anyone mid-request.
 *
 * A deploy stops the old container with SIGTERM and, ten seconds later by
 * Docker's default, SIGKILL. In order: stop accepting connections and let the
 * requests in flight finish, then close the pool -- after, because those
 * requests still need it -- then exit.
 *
 * The timer is for a client that holds a connection open and never finishes.
 * Shorter than Docker's ten seconds so the exit is still this process's own,
 * and unref'd so that it is not itself the thing keeping the process alive.
 */
function shutdown(): void {
    server.close(() => {
        void closeDb().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 8_000).unref();
}

// SIGTERM is Docker's; SIGINT is Ctrl-C in a terminal. Once each: a second
// Ctrl-C from somebody who has stopped waiting ends the process on the spot.
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
