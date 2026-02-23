import GithubProvider from 'next-auth/providers/github';
import type { NextAuthOptions } from 'next-auth';
import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

/** NextAuth configuration — export from here and import into the route handler + server components. */
export const authOptions: NextAuthOptions = {
    providers: [
        GithubProvider({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            // Request repo scope so the token can clone and commit to user repos
            authorization: {
                params: { scope: 'read:user user:email repo' },
            },
        }),
    ],
    callbacks: {
        // Persist the GitHub access token into the JWT on sign-in
        async jwt({ token, account }: { token: JWT; account: { access_token?: string } | null }) {
            if (account?.access_token) {
                token.githubToken = account.access_token;
            }
            return token;
        },
        // Expose the GitHub token on the client-side session object
        async session({ session, token }: { session: Session; token: JWT }) {
            session.githubToken = token.githubToken;
            return session;
        },
    },
    pages: {
        signIn: '/login',
    },
};
