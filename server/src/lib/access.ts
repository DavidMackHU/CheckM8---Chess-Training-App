import type { Prisma } from '../generated/prisma/client.js'

/**
 * Which courses a viewer may see: every public course, plus their own private
 * ones. Pass undefined for guests.
 */
export function visibleTo(userId: string | undefined): Prisma.CourseWhereInput {
  return userId ? { OR: [{ isPublic: true }, { authorId: userId }] } : { isPublic: true }
}
