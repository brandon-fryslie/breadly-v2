"use client";

import { useActionState, useRef } from "react";
import { createListing, type CreateListingState } from "./actions";
import { PhotoField } from "./photo-field";

type Tag = {
  id: string;
  slug: string;
  label: string;
  kind: "style" | "dietary" | "ingredient" | "process" | "kitchen";
};

const initialState: CreateListingState = {
  fieldErrors: {},
  values: {
    name: "",
    blurb: "",
    photoUrl: "",
    priceDollars: "",
    qty: "1",
    readyAt: "",
    tagIds: [],
  },
};

const inputBase =
  "w-full border rounded-md px-3 py-2 focus:outline-none focus:border-stone-500 bg-white";
const inputOk = "border-stone-300";
const inputBad = "border-red-400 focus:border-red-500";

function fieldClass(error?: string) {
  return `${inputBase} ${error ? inputBad : inputOk}`;
}

// `<input type="datetime-local">` returns "YYYY-MM-DDTHH:mm" in the browser's
// local TZ. We send a UTC ISO string instead so the server's interpretation
// doesn't depend on its own TZ — Cloud Run runs in UTC, dev usually doesn't.
function localToIso(local: string): string {
  if (!local) return "";
  const ms = new Date(local).getTime();
  return Number.isNaN(ms) ? "" : new Date(ms).toISOString();
}

export function PostLoafForm({ allTags }: { allTags: Tag[] }) {
  const [state, formAction, pending] = useActionState(createListing, initialState);
  const localInputRef = useRef<HTMLInputElement>(null);
  const isoInputRef = useRef<HTMLInputElement>(null);

  // Echo the previously-entered local value when the action returned an
  // error: the server only sees the ISO field, so we'd otherwise lose what
  // the picker showed. Reverse-derive it on render.
  const lastLocal = state.values.readyAt
    ? new Date(state.values.readyAt).toISOString().slice(0, 16)
    : "";

  const tagsByKind = allTags.reduce<Record<string, Tag[]>>((acc, t) => {
    (acc[t.kind] ??= []).push(t);
    return acc;
  }, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.generalError ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.generalError}
        </p>
      ) : null}

      <label className="text-sm">
        <span className="block text-stone-700 mb-1 font-medium">
          Bread name <span className="text-red-600">*</span>
        </span>
        <input
          name="name"
          type="text"
          required
          maxLength={80}
          autoFocus
          defaultValue={state.values.name}
          placeholder="e.g. Country sourdough"
          className={fieldClass(state.fieldErrors.name)}
        />
        {state.fieldErrors.name ? (
          <span className="text-xs text-red-600 mt-1 block">
            {state.fieldErrors.name}
          </span>
        ) : null}
      </label>

      <label className="text-sm">
        <span className="block text-stone-700 mb-1 font-medium">Blurb</span>
        <textarea
          name="blurb"
          rows={2}
          maxLength={400}
          defaultValue={state.values.blurb}
          placeholder="One line. Why this loaf?"
          className={fieldClass(state.fieldErrors.blurb)}
        />
        {state.fieldErrors.blurb ? (
          <span className="text-xs text-red-600 mt-1 block">
            {state.fieldErrors.blurb}
          </span>
        ) : null}
      </label>

      <PhotoField
        defaultValue={state.values.photoUrl}
        error={state.fieldErrors.photoUrl}
        fieldClass={fieldClass}
      />


      <div className="grid grid-cols-2 gap-4">
        <label className="text-sm">
          <span className="block text-stone-700 mb-1 font-medium">
            Price <span className="text-red-600">*</span>
          </span>
          <div className="flex items-stretch">
            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-stone-300 bg-stone-100 text-stone-500 text-sm">
              $
            </span>
            <input
              name="priceDollars"
              type="number"
              inputMode="decimal"
              required
              min="0"
              step="0.01"
              defaultValue={state.values.priceDollars}
              placeholder="9.00"
              className={`${fieldClass(state.fieldErrors.priceDollars)} rounded-l-none`}
            />
          </div>
          {state.fieldErrors.priceDollars ? (
            <span className="text-xs text-red-600 mt-1 block">
              {state.fieldErrors.priceDollars}
            </span>
          ) : null}
        </label>

        <label className="text-sm">
          <span className="block text-stone-700 mb-1 font-medium">
            Quantity <span className="text-red-600">*</span>
          </span>
          <input
            name="qty"
            type="number"
            inputMode="numeric"
            required
            min={1}
            max={999}
            defaultValue={state.values.qty}
            className={fieldClass(state.fieldErrors.qty)}
          />
          {state.fieldErrors.qty ? (
            <span className="text-xs text-red-600 mt-1 block">
              {state.fieldErrors.qty}
            </span>
          ) : null}
        </label>
      </div>

      <label className="text-sm">
        <span className="block text-stone-700 mb-1 font-medium">
          Ready at <span className="text-red-600">*</span>
        </span>
        <input
          ref={localInputRef}
          type="datetime-local"
          required
          defaultValue={lastLocal}
          onChange={(e) => {
            if (isoInputRef.current) {
              isoInputRef.current.value = localToIso(e.target.value);
            }
          }}
          className={fieldClass(state.fieldErrors.readyAt)}
        />
        <input
          ref={isoInputRef}
          type="hidden"
          name="readyAt"
          defaultValue={state.values.readyAt}
        />
        <span className="text-xs text-stone-500 mt-1 block">
          A time in the past means &quot;just out of the oven&quot; — the
          listing goes live immediately.
        </span>
        {state.fieldErrors.readyAt ? (
          <span className="text-xs text-red-600 mt-1 block">
            {state.fieldErrors.readyAt}
          </span>
        ) : null}
      </label>

      <fieldset className="text-sm">
        <legend className="text-stone-700 mb-2 font-medium">Tags</legend>
        <div className="space-y-3">
          {(Object.keys(tagsByKind) as Array<keyof typeof tagsByKind>).map(
            (kind) => (
              <div key={kind}>
                <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-1">
                  {kind}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tagsByKind[kind].map((t) => {
                    const checked = state.values.tagIds.includes(t.id);
                    return (
                      <label
                        key={t.id}
                        className="cursor-pointer text-xs rounded-full border border-stone-300 bg-white text-stone-700 hover:border-stone-500 px-3 py-1 transition select-none has-[:checked]:border-stone-900 has-[:checked]:bg-stone-900 has-[:checked]:text-white"
                      >
                        <input
                          type="checkbox"
                          name="tagIds"
                          value={t.id}
                          defaultChecked={checked}
                          className="sr-only"
                        />
                        {t.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            ),
          )}
        </div>
        {state.fieldErrors.tagIds ? (
          <span className="text-xs text-red-600 mt-2 block">
            {state.fieldErrors.tagIds}
          </span>
        ) : null}
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="self-start bg-stone-900 text-white rounded-md px-5 py-2.5 hover:bg-stone-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {pending ? "Posting…" : "Post loaf"}
      </button>
    </form>
  );
}
