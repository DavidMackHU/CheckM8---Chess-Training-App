import { sql } from './helpers.ts'

/** Removes everything the tests created: courses written by test users, then the users themselves. */
export default async function globalTeardown() {
  await sql(`DELETE FROM "Course" WHERE "authorId" IN (SELECT id FROM "User" WHERE username LIKE 'pw\\_%')`)
  await sql(`DELETE FROM "User" WHERE username LIKE 'pw\\_%'`)
}
