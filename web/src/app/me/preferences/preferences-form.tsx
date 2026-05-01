"use client";

import { useActionState } from "react";
import { savePreferences, type PreferencesState } from "./actions";

type TagOption = { slug: string; label: string; kind: string };
type NeighborhoodOption = { slug: string; name: string };

type Props = {
  initial: PreferencesState["values"];
  tags: TagOption[];
  neighborhoods: NeighborhoodOption[];
};

const TAG_KIND_LABELS: Record<string, string> = {
  style: "Style",
  dietary: "Dietary",
  ingredient: "Ingredient",
  process: "Process",
  kitchen: "Kitchen",
};

// Order tag kinds the same way every render so the form layout doesn't
// shift when the catalog grows. [LAW:dataflow-not-control-flow]
const TAG_KIND_ORDER = ["style", "dietary", "ingredient", "process", "kitchen"];

export function PreferencesForm({ initial, tags, neighborhoods }: Props) {
  const [state, formAction, pending] = useActionState(savePreferences, {
    fieldErrors: {},
    values: initial,
  });

  // The set the form *renders* prefers the action's last-known state once
  // we've submitted at least once; before then it's the server-loaded
  // initial values. Same shape both ways.
  const values = state.values ?? initial;
  const includeSet = new Set(values.include);
  const excludeSet = new Set(values.exclude);

  const grouped = TAG_KIND_ORDER.map((kind) => ({
    kind,
    label: TAG_KIND_LABELS[kind] ?? kind,
    tags: tags.filter((t) => t.kind === kind),
  })).filter((g) => g.tags.length > 0);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {state.generalError ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.generalError}
        </p>
      ) : null}
      {state.saved ? (
        <p
          role="status"
          className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2"
        >
          Preferences saved.
        </p>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Neighborhood
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Anchors your feed. Distance is measured from this neighborhood's
            centroid.
          </p>
        </div>
        <select
          name="neighborhood"
          defaultValue={values.neighborhood}
          aria-label="Neighborhood"
          className="w-full border border-stone-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-stone-500"
        >
          <option value="">— pick a neighborhood —</option>
          {neighborhoods.map((n) => (
            <option key={n.slug} value={n.slug}>
              {n.name}
            </option>
          ))}
        </select>
        {state.fieldErrors.neighborhood ? (
          <span className="text-xs text-red-600 block">
            {state.fieldErrors.neighborhood}
          </span>
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Search radius
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Miles from your neighborhood. The feed hides loaves further than this.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            name="radiusMi"
            min={1}
            max={10}
            step={1}
            defaultValue={values.radiusMi}
            aria-label="Search radius in miles"
            className="w-24 border border-stone-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-stone-500"
          />
          <span className="text-sm text-stone-600">miles</span>
        </div>
        {state.fieldErrors.radiusMi ? (
          <span className="text-xs text-red-600 block">
            {state.fieldErrors.radiusMi}
          </span>
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Include
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Tags you want to see prioritized in your feed.
          </p>
        </div>
        {grouped.map((g) => (
          <fieldset key={`include-${g.kind}`} className="space-y-1">
            <legend className="text-xs text-stone-500 mb-1">{g.label}</legend>
            <div className="flex flex-wrap gap-2">
              {g.tags.map((t) => (
                <TagCheckbox
                  key={`include-${t.slug}`}
                  name="include"
                  value={t.slug}
                  label={t.label}
                  checked={includeSet.has(t.slug)}
                />
              ))}
            </div>
          </fieldset>
        ))}
        {state.fieldErrors.include ? (
          <span className="text-xs text-red-600 block">
            {state.fieldErrors.include}
          </span>
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Exclude
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Deal-breakers — these are hidden by default. Use for allergens or
            tastes you don't want.
          </p>
        </div>
        {grouped.map((g) => (
          <fieldset key={`exclude-${g.kind}`} className="space-y-1">
            <legend className="text-xs text-stone-500 mb-1">{g.label}</legend>
            <div className="flex flex-wrap gap-2">
              {g.tags.map((t) => (
                <TagCheckbox
                  key={`exclude-${t.slug}`}
                  name="exclude"
                  value={t.slug}
                  label={t.label}
                  checked={excludeSet.has(t.slug)}
                />
              ))}
            </div>
          </fieldset>
        ))}
        {state.fieldErrors.exclude ? (
          <span className="text-xs text-red-600 block">
            {state.fieldErrors.exclude}
          </span>
        ) : null}
      </section>

      <button
        type="submit"
        disabled={pending}
        className="self-start bg-stone-900 text-white rounded-md px-4 py-2 hover:bg-stone-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {pending ? "Saving…" : "Save preferences"}
      </button>
    </form>
  );
}

// Render-as-a-pill checkbox. The label is the click target; the underlying
// checkbox is the form value. `defaultChecked` keeps this component
// uncontrolled — the form data flows from DOM to action without a parent
// state mirror. [LAW:one-source-of-truth]
function TagCheckbox({
  name,
  value,
  label,
  checked,
}: {
  name: "include" | "exclude";
  value: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label
      className="inline-flex items-center gap-1.5 cursor-pointer text-sm rounded-full border border-stone-300 bg-white px-3 py-1.5 hover:border-stone-500 has-[:checked]:bg-stone-900 has-[:checked]:text-white has-[:checked]:border-stone-900"
    >
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={checked}
        className="sr-only"
      />
      {label}
    </label>
  );
}
