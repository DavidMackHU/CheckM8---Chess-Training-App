import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'

// Read directly (not via env.ts) so scripts like the seed only need DATABASE_URL.
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('Missing required environment variable DATABASE_URL. See server/.env.example.')
}

// Hosted databases such as Supabase need an encrypted connection.
const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, ssl }) })
