// Clerk middleware. Routes are public by default; we explicitly protect
// the baker portal and operator console once those exist (later epics).
// For E1, the four feed routes and the test menu remain anonymous.

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtected = createRouteMatcher([
  "/baker(.*)",
  "/operator(.*)",
  "/me(.*)",
  // /dev-tools is intentionally NOT here. Edge protection redirects anon
  // traffic to sign-in, which leaks that the route exists. The single gate
  // in src/lib/dev-tools-gate.ts handles auth itself: missing session →
  // notFound() → indistinguishable from a non-existent route.
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
