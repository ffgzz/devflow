import "server-only";

import { auth } from "@/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/http-errors";

export async function requireAuthenticatedUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) throw new UnauthorizedError();

  return userId;
}

export function requireSelf(viewerId: string, resourceOwnerId: string) {
  if (viewerId !== resourceOwnerId) throw new ForbiddenError();
}
