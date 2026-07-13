import "server-only";

import Account from "@/database/account.model";
import User from "@/database/user.model";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/http-errors";
import { dbConnect } from "@/lib/mongoose";
import { SignInWithOAuthSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import mongoose, { type ClientSession } from "mongoose";
import slugify from "slugify";

type OAuthProvider = "github" | "google";

type OAuthIdentity = {
  provider: OAuthProvider;
  providerAccountId: string;
  user: {
    name: string;
    username: string;
    email: string;
    image?: string;
  };
};

type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

// Comparing against a fixed hash keeps unknown-email and wrong-password paths
// close in cost, reducing a simple timing-based email enumeration signal.
const INVALID_PASSWORD_HASH =
  "$2b$12$J1TNuVLnLP95rFiaS1hj7OiSh.nGIKzYg1CdzCScktvwJpAeNFKEa";

function normalizedEmail(email: string) {
  return email.trim().toLowerCase();
}

async function availableUsername(
  requestedUsername: string,
  identityKey: string,
  session: ClientSession,
) {
  const slug = slugify(requestedUsername, {
    lower: true,
    strict: true,
    trim: true,
  });
  const base = (slug.length >= 3 ? slug : "user").slice(0, 30);

  const isTaken = await User.exists({ username: base }).session(session);
  if (!isTaken) return base;

  const suffix = createHash("sha256")
    .update(identityKey)
    .digest("hex")
    .slice(0, 8);
  return `${base.slice(0, 21)}-${suffix}`;
}

/** Verify credentials without ever exposing the password hash through HTTP. */
export async function authenticateCredentials(
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  await dbConnect();

  const account = await Account.findOne({
    provider: "credentials",
    providerAccountId: normalizedEmail(email),
  })
    .collation({ locale: "en", strength: 2 })
    .select("userId +password");

  const passwordMatches = await bcrypt.compare(
    password,
    account?.password ?? INVALID_PASSWORD_HASH,
  );
  if (!account?.password || !passwordMatches) return null;

  const user = await User.findById(account.userId)
    .select("name email image")
    .lean();
  if (!user) return null;

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.image,
  };
}

export async function getOAuthUserId(
  provider: OAuthProvider,
  providerAccountId: string,
) {
  await dbConnect();

  const account = await Account.findOne({ provider, providerAccountId })
    .select("userId")
    .lean();

  return account?.userId?.toString() ?? null;
}

/**
 * Synchronize a trusted OAuth callback with local records.
 *
 * A new provider identity is never linked only because its email matches an
 * existing user. Account linking requires a separate, authenticated flow.
 */
export async function syncOAuthIdentity(input: OAuthIdentity): Promise<string> {
  const parsed = SignInWithOAuthSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  await dbConnect();
  const session = await mongoose.startSession();
  let resolvedUserId: string | null = null;

  try {
    await session.withTransaction(async () => {
      const { provider, providerAccountId, user } = parsed.data;
      const email = normalizedEmail(user.email);

      const existingAccount = await Account.findOne({
        provider,
        providerAccountId,
      }).session(session);

      if (existingAccount) {
        const existingUser = await User.findById(existingAccount.userId).session(
          session,
        );
        if (!existingUser) throw new NotFoundError("User");

        const userUpdates: { name?: string; image?: string } = {};
        if (existingUser.name !== user.name) userUpdates.name = user.name;
        if (user.image && existingUser.image !== user.image) {
          userUpdates.image = user.image;
        }

        if (Object.keys(userUpdates).length > 0) {
          await User.updateOne(
            { _id: existingUser._id },
            { $set: userUpdates },
            { session },
          );
        }

        resolvedUserId = existingUser._id.toString();
        return;
      }

      // Do not silently attach a new provider to an account with the same email.
      const userWithEmail = await User.findOne({ email })
        .collation({ locale: "en", strength: 2 })
        .session(session);
      if (userWithEmail) {
        throw new ForbiddenError(
          "An account already exists with this email. Sign in with the original method before linking another provider.",
        );
      }

      const username = await availableUsername(
        user.username,
        `${provider}:${providerAccountId}`,
        session,
      );
      const [createdUser] = await User.create(
        [
          {
            name: user.name,
            username,
            email,
            image: user.image,
          },
        ],
        { session },
      );

      await Account.create(
        [
          {
            userId: createdUser._id,
            name: user.name,
            image: user.image,
            provider,
            providerAccountId,
          },
        ],
        { session },
      );

      resolvedUserId = createdUser._id.toString();
    });
  } finally {
    await session.endSession();
  }

  if (!resolvedUserId) {
    throw new Error("OAuth account synchronization did not resolve a user.");
  }

  return resolvedUserId;
}
