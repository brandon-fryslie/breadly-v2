// Top-of-page auth + nav. Anonymous → sign-in / sign-up buttons.
// Authenticated → user button + capability-aware links (Baker, Operator).
//
// Capability links use server-rendered DB data, not Clerk publicMetadata —
// our local `users` row is the source of truth for canBake/canOperate.
// [LAW:one-source-of-truth]

import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

async function getCapabilities(): Promise<{ canBake: boolean; canOperate: boolean } | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { canBake: true, canOperate: true },
  });
  return row ?? null;
}

export async function Header() {
  const caps = await getCapabilities();
  return (
    <header className="border-b border-stone-200 bg-white/70 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-6">
        <Link href="/" className="font-semibold tracking-tight text-stone-900">
          Breadly
        </Link>
        <nav className="flex items-center gap-4 text-sm text-stone-700">
          <Link href="/a" className="hover:text-stone-900">Feed</Link>
          {caps?.canBake ? (
            <Link href="/baker" className="hover:text-stone-900">Baker</Link>
          ) : null}
          {caps?.canOperate ? (
            <Link href="/operator" className="hover:text-stone-900">Operator</Link>
          ) : null}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="text-sm text-stone-700 hover:text-stone-900">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="text-sm bg-stone-900 text-white rounded-md px-3 py-1.5 hover:bg-stone-700">
                Sign up
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <Link href="/me" className="text-sm text-stone-700 hover:text-stone-900">
              Profile
            </Link>
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  );
}
