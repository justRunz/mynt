import { execFileSync } from 'node:child_process'

/**
 * Brings the test database up to date before any test runs.
 *
 * The suite therefore needs nothing prepared by hand beyond a running
 * container: a colleague, or a machine that has never seen this project, runs
 * `pnpm test` and it works. The alternative -- documenting a migration step
 * somebody has to remember -- fails the first time someone forgets, and fails
 * as an assertion about missing tables rather than as a missing step.
 */
export function setup() {
  execFileSync('pnpm', ['exec', 'dbmate', '--wait', 'up'], {
    cwd: new URL('../../../..', import.meta.url).pathname,
    // dbmate migrates as the owner: creating tables, roles and policies needs
    // privileges the application role deliberately does not have.
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
    stdio: 'inherit',
  })
}
