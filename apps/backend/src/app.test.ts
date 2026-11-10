import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createApp } from "./app.js";
import { closeDb } from "./db/index.js";

/**
 * The server over real HTTP.
 *
 * Everything else in the suite calls services, which is right for rules that
 * live in the database. What is tested here only exists on the wire: status
 * codes from middleware that runs before any service, and response headers.
 */

let server: Server;
let base = "";

beforeAll(async () => {
    server = createApp().listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeDb();
});

function post(path: string, body: string) {
    return fetch(base + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
    });
}

describe("a body the parser refuses", () => {
    test("JSON that does not parse is the client's mistake, not a crash", async () => {
        const response = await post("/binders", '{"name": "oups"');
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: "invalid_request" });
    });

    test("a body over the limit is too large, not a crash", async () => {
        const response = await post(
            "/binders",
            JSON.stringify({ name: "x".repeat(200_000) }),
        );
        expect(response.status).toBe(413);
        expect(await response.json()).toEqual({ error: "payload_too_large" });
    });
});

describe("every response", () => {
    test("carries the headers a browser needs, and does not name the framework", async () => {
        // A 401 is as good a response as any: the headers are set before routing.
        const response = await fetch(`${base}/collection`);

        expect(response.headers.get("x-content-type-options")).toBe("nosniff");
        expect(response.headers.get("x-frame-options")).toBe("DENY");
        expect(response.headers.get("referrer-policy")).toBe("no-referrer");
        expect(response.headers.get("x-powered-by")).toBeNull();
    });
});

describe("the edges of /api", () => {
    test("health says whether the database answers, to a caller holding no token", async () => {
        const response = await fetch(`${base}/health`);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ok: true });
    });

    test("an address no route claims is answered in JSON, never with a page", async () => {
        // 401 here, since the caller is nobody; 404 for someone signed in. What
        // matters is that neither is the front end's index.html with a 200.
        const response = await fetch(`${base}/nope`);
        expect(response.status).toBe(401);
        expect(response.headers.get("content-type")).toContain(
            "application/json",
        );
    });
});

describe("the routes that can be abused", () => {
    function json(path: string, body: object) {
        return post(path, JSON.stringify(body));
    }

    test("ten wrong passwords for one address, then a refusal to keep guessing", async () => {
        const codes: number[] = [];
        for (let attempt = 0; attempt < 11; attempt++) {
            const response = await json("/auth/sign-in", {
                email: "cible@mynt.test",
                password: `essai numero ${attempt}`,
            });
            codes.push(response.status);
        }
        expect(codes.slice(0, 10).every((code) => code === 401)).toBe(true);
        expect(codes[10]).toBe(429);
    });

    test("three messages an hour to one mailbox, whether or not it has an account", async () => {
        // An address with no account, so nothing is sent -- and the fourth request
        // is still refused. Counting only real sends would reveal which addresses
        // are registered.
        const codes: number[] = [];
        for (let attempt = 0; attempt < 4; attempt++) {
            codes.push(
                (
                    await json("/auth/forgot-password", {
                        email: "boite@exemple.test",
                    })
                ).status,
            );
        }
        expect(codes).toEqual([204, 204, 204, 429]);

        const refused = await json("/auth/forgot-password", {
            email: "boite@exemple.test",
        });
        expect(await refused.json()).toEqual({ error: "too_many_requests" });
    });

    test("and a ceiling per caller across all of them", async () => {
        // Bogus confirmation links: cheap to answer, and each one counts.
        const codes: number[] = [];
        for (let attempt = 0; attempt < 35; attempt++) {
            codes.push(
                (
                    await json("/auth/verify-email", {
                        token: `invente-${attempt}`,
                    })
                ).status,
            );
        }
        expect(codes).toContain(429);
        expect(codes.filter((code) => code !== 429).length).toBeLessThanOrEqual(
            30,
        );
    });
});
