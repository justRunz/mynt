import { defineConfig } from 'vitest/config'

// Both files, because the suite straddles both: the root .env has the test
// database the fixtures build on, and this package's .env has the settings the
// server code under test refuses to start without. Node reads them natively, so
// no dotenv dependency.
process.loadEnvFile(new URL('../../.env', import.meta.url).pathname)
process.loadEnvFile(new URL('./.env', import.meta.url).pathname)

// Mail goes to the local catcher, whatever the server's own file says.
//
// apps/backend/.env points at the real relay once Resend is configured, and the
// suite loads that file. A test that exercised sign-up over HTTP would then send
// genuine mail to made-up addresses -- bounces charged to the domain's sending
// reputation. Overridden after loading, because loadEnvFile never replaces a
// variable that is already set, and assignment does.
process.env.SMTP_HOST = '127.0.0.1'
process.env.SMTP_PORT = '1025'
process.env.SMTP_USER = ''
process.env.SMTP_PASSWORD = ''
process.env.MAIL_FROM = 'Mynt tests <tests@mynt.local>'

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
