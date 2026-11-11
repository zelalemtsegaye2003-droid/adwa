import { PrismaClient } from '@prisma/client'
import { validateEnv } from '@/lib/env'

// Fail fast on a misconfigured environment (bad DATABASE_URL / missing
// AUTH_SECRET) instead of surfacing runtime 500s later. No-op during build.
validateEnv()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db