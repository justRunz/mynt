import { defineConfig } from 'vitest/config'

// The repo's .env, since the suite needs the same connection strings the rest
// of the tooling uses. Node reads it natively, so no dotenv dependency.
process.loadEnvFile(new URL('../../.env', import.meta.url).pathname)

// The code under test connects as mynt_app, and it has to. Pointing it at the
// owner would make every isolation assertion pass while proving nothing, since
// an owner bypasses row level security.
process.env.APP_DATABASE_URL = process.env.TEST_APP_DATABASE_URL

export default defineConfig({
  test: {
    // The tests need a real database: row level security is the thing under
    // test, and mocking it would only assert that the mock was written
    // correctly. One process at a time, so two files cannot fight over rows.
    fileParallelism: false,
    globalSetup: ['./src/test/migrate.ts'],
  },
})
