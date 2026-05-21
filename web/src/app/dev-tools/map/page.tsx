import { isDevModeEnabled } from "@/lib/dev-tools-gate";
import { notFound } from "next/navigation";
import { MapVerify } from "./map-verify";

export const dynamic = "force-dynamic";

export default async function MapTestPage() {
  if (!isDevModeEnabled()) notFound();
  return (
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-amber-700 mb-2">
          Dev tools · MAP1
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Google Maps — setup verification
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Confirms the API key is wired and the shared{" "}
          <code>&lt;Map&gt;</code> component renders without errors.
        </p>
      </header>
      <MapVerify />
    </main>
  );
}
