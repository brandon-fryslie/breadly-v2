// Clerk middleware. Routes are public by default; we explicitly protect
// the baker portal and operator console once those exist (later epics).
// For E1, the four feed routes and the test menu remain anonymous.

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtected = createRouteMatcher([
  "/baker(.*)",
  "/operator(.*)",
  "/me(.*)",
  // /dev-tools has its own env+capability gate in src/lib/dev-tools-gate.ts;
  // we still require a Clerk session at the edge so the gate can read userId.
  "/dev-tools(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on everything except Next internals + static assets.
    "/((?!_next|.*\\..*).*)",
    // Always run on API routes.
    "/(api|trpc)(.*)",
  ],
};
