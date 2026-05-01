// Global setup for Playwright. Reads Clerk keys from the keyless dev file
// the running Next dev server provisioned, exports them into process.env
// so @clerk/testing's helpers can mint sign-in tickets, and pings clerkSetup.
// Also gates the entire suite on ADC being resolvable — missing ADC is a
// hard suite failure, never a per-test skip. [LAW:single-enforcer]

import { clerkSetup } from "@clerk/testing/playwright";
import { GoogleAuth } from "google-auth-library";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function loadKeylessClerkCreds() {
  const file = path.resolve(__dirname, "..", ".clerk/.tmp/keyless.json");
  const raw = await readFile(file, "utf8");
  const json = JSON.parse(raw) as {
    publishableKey: string;
    secretKey: string;
  };
  return {
    publishableKey: json.publishableKey,
    secretKey: json.secretKey,
  };
}

// Resolves credentials the same way @google-cloud/storage does at runtime,
// so the gate matches production behavior — env vars OR the file written by
// `gcloud auth application-default login` both count as configured.
async function assertAdcConfigured() {
  const auth = new GoogleAuth();
  try {
    await auth.getCredentials();
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(
      [
        "ADC is not configured — refusing to run the test suite.",
        "Run: gcloud auth application-default login",
        "Or set GOOGLE_APPLICATION_CREDENTIALS / GOOGLE_APPLICATION_CREDENTIALS_JSON.",
        `Underlying error: ${reason}`,
      ].join("\n"),
    );
  }
}

export default async function globalSetup() {
  await assertAdcConfigured();

  const { publishableKey, secretKey } = await loadKeylessClerkCreds();
  process.env.CLERK_PUBLISHABLE_KEY = publishableKey;
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = publishableKey;
  process.env.CLERK_SECRET_KEY = secretKey;

  await clerkSetup({ publishableKey, secretKey });
}
