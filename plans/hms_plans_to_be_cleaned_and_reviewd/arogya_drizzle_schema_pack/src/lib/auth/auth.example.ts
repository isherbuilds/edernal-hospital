import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { admin, organization, twoFactor, phoneNumber, jwt } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import { passkey } from "@better-auth/passkey";
import { oauthProvider } from "@better-auth/oauth-provider";
import { db } from "../../db";
import * as schema from "../../db/schema";

/**
 * Better Auth configuration example for Arogya OS.
 *
 * The committed auth.generated.ts is a schema snapshot matching this plugin posture.
 * Regenerate it whenever plugin configuration changes:
 *   pnpm auth:generate
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
    expiresIn: 60 * 60 * 12,
    updateAge: 60 * 15,
  },
  user: {
    additionalFields: {
      defaultTenantId: { type: "string", required: false, input: false },
      defaultFacilityId: { type: "string", required: false, input: false },
      locale: { type: "string", required: false, defaultValue: "en-IN" },
      timezone: { type: "string", required: false, defaultValue: "Asia/Kolkata" },
      profileCompleteness: { type: "number", required: false, input: false },
      metadata: { type: "object", required: false, input: false },
    },
  },
  plugins: [
    admin(),
    organization({
      teams: { enabled: true },
      allowUserToCreateOrganization: false,
    }),
    twoFactor(),
    passkey(),
    phoneNumber({
      sendOTP: async ({ phoneNumber, code }) => {
        // Wire to WhatsApp/SMS integration service. Do not log OTP or phone number in plaintext.
        console.info("phone OTP requested", { phoneNumberHashOnly: true, codeLength: code.length });
      },
    }),
    jwt(),
    apiKey(),
    oauthProvider({
      loginPage: "/sign-in",
      consentPage: "/oauth/consent",
    }),
  ],
});
