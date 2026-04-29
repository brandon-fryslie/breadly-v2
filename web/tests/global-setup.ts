// Global setup for Playwright. Reads Clerk keys from the keyless dev file
// the running Next dev server provisioned, exports them into process.env
// so @clerk/testing's helpers can mint sign-in tickets, and pings clerkSetup.

import { clerkSetup } from "@clerk/testing/playwright";
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

export default async function globalSetup() {
  const { publishableKey, secretKey } = await loadKeylessClerkCreds();
  process.env.CLERK_PUBLISHABLE_KEY = publishableKey;
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = publishableKey;
  process.env.CLERK_SECRET_KEY = secretKey;

  await clerkSetup({ publishableKey, secretKey });
}
