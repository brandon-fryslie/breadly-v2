// Shared UI atoms used across the four feed variants.

import type { UiTag } from "./types";

export const TestBanner = ({ variant, label }: { variant: "A" | "B" | "C" | "D"; label: string }) => (
  <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center justify-between gap-4">
    <span>
      <strong className="font-semibold">Variant {variant}:</strong> {label}.
      Mockup. Nothing is real.
    </span>
    <nav className="flex gap-3 text-amber-700">
      <a href="/" className="hover:underline">test menu</a>
      <a href="/a" className={variant === "A" ? "font-semibold" : "hover:underline"}>A</a>
      <a href="/b" className={variant === "B" ? "font-semibold" : "hover:underline"}>B</a>
      <a href="/c" className={variant === "C" ? "font-semibold" : "hover:underline"}>C</a>
      <a href="/d" className={variant === "D" ? "font-semibold" : "hover:underline"}>D</a>
    </nav>
  </div>
);

// A bread image card with a warm gradient placeholder so the layout reads
// even if the network photo fails to load.
export const BreadImg = ({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) => (
  <div
    className={`relative overflow-hidden bg-gradient-to-br from-amber-100 via-orange-200 to-amber-700 ${className}`}
  >
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="absolute inset-0 w-full h-full object-cover"
    />
  </div>
);

export const TagPill = ({ tag, dim = false }: { tag: UiTag; dim?: boolean }) => (
  <span
    className={`inline-block text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
      dim ? "bg-stone-100 text-stone-500" : "bg-stone-200 text-stone-700"
    }`}
  >
    {tag}
  </span>
);

export const Stars = ({ rating, reviews }: { rating: number; reviews: number }) => (
  <span className="text-xs text-stone-600">
    <span className="text-amber-600">★</span> {rating.toFixed(1)}{" "}
    <span className="text-stone-400">({reviews})</span>
  </span>
);
