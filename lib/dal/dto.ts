import "server-only";

type UserSummarySource = {
  _id: unknown;
  name: string;
  username: string;
  image?: string | null;
  reputation?: number | null;
};

type UserProfileSource = UserSummarySource & {
  bio?: string | null;
  location?: string | null;
  portfolio?: string | null;
  createdAt?: Date | string | null;
};

type AccountSource = {
  _id: unknown;
  name: string;
  image?: string | null;
  provider: string;
};

function serializeId(id: unknown): string {
  if (typeof id === "string") return id;
  if (id && typeof id === "object" && "toString" in id) {
    return String(id);
  }

  throw new TypeError("Cannot serialize a record without an id.");
}

/** Safe fields for user lists such as the community page. */
export function toUserSummaryDTO(user: UserSummarySource) {
  return {
    _id: serializeId(user._id),
    name: user.name,
    username: user.username,
    image: user.image ?? undefined,
    reputation: user.reputation ?? 0,
  };
}

/** Public profile fields. Email and internal timestamps are intentionally absent. */
export function toUserProfileDTO(user: UserProfileSource) {
  return {
    ...toUserSummaryDTO(user),
    bio: user.bio ?? undefined,
    location: user.location ?? undefined,
    portfolio: user.portfolio ?? undefined,
    createdAt:
      user.createdAt instanceof Date
        ? user.createdAt.toISOString()
        : (user.createdAt ?? undefined),
  };
}

/** Linked-account metadata safe to show to its owner. */
export function toAccountDTO(account: AccountSource) {
  return {
    _id: serializeId(account._id),
    name: account.name,
    image: account.image ?? undefined,
    provider: account.provider,
  };
}
