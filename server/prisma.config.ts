import { defineConfig } from 'prisma/config'

try {
  process.loadEnvFile('.env')
} catch {
  // No .env file: rely on real environment variables, as on Render.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
})
