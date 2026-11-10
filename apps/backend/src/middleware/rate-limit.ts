import type { Request } from 'express'
import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit'

/**
 * How often the routes that can be abused may be called.
 *
 * Counted in memory, which is enough while one container serves everything and
 * wrong the day there are two: each would keep its own tally and the real limit
 * would double. Counting that survives more than one instance needs a shared
 * store, which is a problem for when it exists.
 *
 * Behind a proxy, every request arrives from the proxy's address. TRUST_PROXY
 * tells Express how many hops to peel off to find the caller's; without it these
 * limits would throttle everybody at once, as a single client.
 */

const MINUTE = 60 * 1000

const common: Partial<Options> = {
  // RateLimit and RateLimit-Policy on every limited response, Retry-After on a
  // refusal: a client can see how close it is, and when to try again.
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json({ error: 'too_many_requests' })
  },
}

/**
 * The address a request is about, or the caller's IP when it names none.
 *
 * Keying on the address is what stops an attack spread across many IPs: each
 * would stay under a per-IP limit while the same account, or the same stranger's
 * mailbox, takes every blow.
 */
function addressOrIp(req: Request): string {
  const email: unknown = req.body?.email
  if (typeof email === 'string') return `email:${email.trim().toLowerCase()}`
  // ipKeyGenerator groups an IPv6 caller by subnet. Keyed on the full address,
  // one machine could rotate through billions of them and never be counted.
  return `ip:${ipKeyGenerator(req.ip ?? '')}`
}

/**
 * Per caller, across every route that takes a credential or sends mail.
 *
 * Generous on purpose -- a person signing in, mistyping twice and asking for a
 * reset uses a handful -- so it only ever meets something scripted.
 */
export const perIpLimit = rateLimit({ ...common, windowMs: 15 * MINUTE, limit: 30 })

/**
 * Failed sign-ins against one address.
 *
 * Only failures count: skipSuccessfulRequests takes a success back off the
 * tally, so the owner who gets it right is never slowed by someone else guessing.
 * Ten guesses in a quarter of an hour is nothing against a real password and
 * everything against a list of common ones.
 */
export const signInLimit = rateLimit({
  ...common,
  windowMs: 15 * MINUTE,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: addressOrIp,
})

/**
 * Mail sent to one address, whoever asks for it.
 *
 * Sign-up and the forgotten-password form both put a message in a stranger's
 * mailbox on request, from a domain whose reputation is ours. Three an hour is
 * more than anyone needs and too few to use this server to flood somebody.
 * Every request counts, sent or not: counting only real sends would reveal which
 * addresses have an account.
 */
export const mailLimit = rateLimit({
  ...common,
  windowMs: 60 * MINUTE,
  limit: 3,
  keyGenerator: addressOrIp,
})

/**
 * Analyses requested by one account.
 *
 * Every call is a paid request to an AI provider, so the cost of a loop in a
 * script is real money. Keyed on the user rather than the address: the route
 * sits behind authenticate, and a signed-in account is the thing that spends.
 */
export const importLimit = rateLimit({
  ...common,
  windowMs: 60 * MINUTE,
  limit: 20,
  keyGenerator: (req) => `user:${req.userId ?? ipKeyGenerator(req.ip ?? '')}`,
})
