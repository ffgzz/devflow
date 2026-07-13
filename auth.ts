import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { SignInSchema } from "./lib/validations";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub,
    Google,
    Credentials({
      async authorize(credentials) {
        const validatedFields = SignInSchema.safeParse(credentials);
        if (!validatedFields.success) return null;

        const { authenticateCredentials } = await import("./lib/dal/auth");
        const { email, password } = validatedFields.data;

        return authenticateCredentials(email, password);
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },

    async jwt({ token, account, user }) {
      // The credentials DAL already returns the local database id.
      if (account?.type === "credentials") {
        if (!user.id) return null;
        token.sub = user.id;
        return token;
      }

      if (
        account &&
        (account.provider === "github" || account.provider === "google")
      ) {
        const { getOAuthUserId } = await import("./lib/dal/auth");
        const userId = await getOAuthUserId(
          account.provider,
          account.providerAccountId,
        );

        // Never fall back to the provider's id as the local authorization id.
        if (!userId) return null;
        token.sub = userId;
      }

      return token;
    },

    async signIn({ user, profile, account }) {
      if (account?.type === "credentials") return true;

      if (
        !account ||
        !user.name ||
        !user.email ||
        (account.provider !== "github" && account.provider !== "google")
      ) {
        return false;
      }

      // Google exposes this verification flag in its OIDC profile.
      if (account.provider === "google" && profile?.email_verified !== true) {
        return false;
      }

      const githubLogin =
        account.provider === "github" && typeof profile?.login === "string"
          ? profile.login
          : null;
      const requestedUsername = githubLogin ?? user.name;
      const username =
        requestedUsername.trim().length >= 3
          ? requestedUsername
          : `user-${account.providerAccountId}`;

      const { syncOAuthIdentity } = await import("./lib/dal/auth");
      await syncOAuthIdentity({
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        user: {
          name: user.name,
          email: user.email,
          image: user.image ?? undefined,
          username,
        },
      });

      return true;
    },
  },
});
