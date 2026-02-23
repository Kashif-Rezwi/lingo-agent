import type { Session } from 'next-auth';

// Declare the extended session type with githubToken globally
declare module 'next-auth' {
    interface Session {
        githubToken?: string;
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        githubToken?: string;
    }
}
