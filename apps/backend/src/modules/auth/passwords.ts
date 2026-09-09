import { hash, hashSync, verify, type Algorithm } from '@node-rs/argon2'

/**
 * Turning a password into something a stolen database cannot use.
 *
 * argon2id rather than bcrypt, and the difference is what the attacker has to
 * buy. bcrypt needs almost no memory, so guesses parallelise onto a graphics
 * card thousands at a time. argon2id makes each guess claim megabytes, and
 * memory is the one resource a GPU cannot multiply -- so the same hardware runs
 * a few dozen guesses instead of a few thousand.
 */

/**
 * OWASP's floor for argon2id: 19 MiB, two passes, one lane.
 *
 * Written out rather than left to the library's defaults, because these numbers
 * are a decision -- they set how long a sign-in takes and how much a guess costs
 * -- and a default that moves in a minor release would change both silently.
 *
 * Existing hashes are unaffected if these ever rise: the parameters travel
 * inside the hash string, so verification uses whatever the row was written
 * with. Only new hashes take the new cost.
 */
/** Algorithm.Argon2id. Spelled as a number because the package declares that
 *  enum as an ambient const enum, which verbatimModuleSyntax forbids reading
 *  at runtime -- the type still checks the value. */
const ARGON2ID = 2 as Algorithm

const PARAMS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const

/**
 * A real hash of a password nobody has.
 *
 * Its only job is to be verified against when an email address matches no
 * account, so that "no such account" and "wrong password" cost the same
 * milliseconds. Without it, sign-in answers a question it was never asked:
 * whether an address is registered, measurable with a stopwatch.
 *
 * Built at load with the parameters above, so the decoy stays exactly as
 * expensive as the real thing even after they change.
 */
const DECOY = hashSync('a password that is not anybody\'s', PARAMS)

export function hashPassword(password: string): Promise<string> {
  return hash(password, PARAMS)
}

/**
 * Whether a password matches, with a missing account costing the same as a
 * wrong one.
 *
 * Taking `string | null` is the point: the caller passes what the lookup found,
 * including nothing, and the timing defence lives here where it cannot be
 * forgotten at a call site.
 */
export async function verifyPassword(
  storedHash: string | null,
  password: string,
): Promise<boolean> {
  const matched = await verify(storedHash ?? DECOY, password, PARAMS)
  // The decoy cannot match, so the first half is belt to the second's braces --
  // and it says plainly that a null hash is never a success.
  return storedHash !== null && matched
}
