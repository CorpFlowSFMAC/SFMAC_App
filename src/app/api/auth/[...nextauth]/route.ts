import NextAuth, { Account, Session } from "next-auth";
import NextAuthAzureADProvider from "next-auth/providers/azure-ad";

export const authOptions = {
  providers: [
    NextAuthAzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID || '18a47ee7-7ecc-4978-9e78-06fd4ea0b343',
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || '',
      tenantId: process.env.AZURE_AD_TENANT_ID || '7b359926-1313-48e4-a459-1f7a9f5c63aa',
      authorization: { params: { scope: "openid profile email User.Read" } },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }: { token: any; user?: any; account?: Account | null }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: any }) {
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };