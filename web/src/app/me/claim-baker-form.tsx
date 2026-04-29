"use client";

import { useActionState } from "react";
import { claimBaker, type ClaimBakerState } from "./actions";

const initialState: ClaimBakerState = {
  fieldErrors: {},
  values: {
    bakeryName: "",
    slug: "",
    neighborhood: "",
    bio: "",
    coverPhotoUrl: "",
    pickupWindowText: "",
  },
};

const inputBase =
  "w-full border rounded-md px-3 py-2 focus:outline-none focus:border-stone-500 bg-white";
const inputOk = "border-stone-300";
const inputBad = "border-red-400 focus:border-red-500";

function fieldClass(error?: string) {
  return `${inputBase} ${error ? inputBad : inputOk}`;
}

export function ClaimBakerForm() {
  const [state, formAction, pending] = useActionState(claimBaker, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.generalError ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.generalError}
        </p>
      ) : null}

      <label className="text-sm">
        <span className="block text-stone-700 mb-1 font-medium">
          Bakery name <span className="text-red-600">*</span>
        </span>
        <input
          name="bakeryName"
          type="text"
          required
          maxLength={80}
          defaultValue={state.values.bakeryName}
          placeholder="e.g. Boulder Hearth"
          className={fieldClass(state.fieldErrors.bakeryName)}
        />
        {state.fieldErrors.bakeryName ? (
          <span className="text-xs text-red-600 mt-1 block">
            {state.fieldErrors.bakeryName}
          </span>
        ) : null}
      </label>

      <label className="text-sm">
        <span className="block text-stone-700 mb-1 font-medium">
          Storefront URL
        </span>
        <div className="flex items-stretch">
          <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-stone-300 bg-stone-100 text-stone-500 text-sm">
            /b/
          </span>
          <input
            name="slug"
            type="text"
            maxLength={48}
            defaultValue={state.values.slug}
            placeholder="leave blank to use bakery name"
            className={`${fieldClass(state.fieldErrors.slug)} rounded-l-none`}
          />
        </div>
        <span className="text-xs text-stone-500 mt-1 block">
          Lowercase letters, numbers, and hyphens. Must be unique.
        </span>
        {state.fieldErrors.slug ? (
          <span className="text-xs text-red-600 mt-1 block">
            {state.fieldErrors.slug}
          </span>
        ) : null}
      </label>

      <label className="text-sm">
        <span className="block text-stone-700 mb-1 font-medium">
          Neighborhood
        </span>
        <input
          name="neighborhood"
          type="text"
          maxLength={60}
          defaultValue={state.values.neighborhood}
          placeholder="e.g. Mapleton Hill"
          className={fieldClass(state.fieldErrors.neighborhood)}
        />
        {state.fieldErrors.neighborhood ? (
          <span className="text-xs text-red-600 mt-1 block">
            {state.fieldErrors.neighborhood}
          </span>
        ) : null}
      </label>

      <label className="text-sm">
        <span className="block text-stone-700 mb-1 font-medium">Bio</span>
        <textarea
          name="bio"
          rows={3}
          maxLength={500}
          defaultValue={state.values.bio}
          placeholder="Tell eaters what you bake. A sentence or two is plenty."
          className={fieldClass(state.fieldErrors.bio)}
        />
        {state.fieldErrors.bio ? (
          <span className="text-xs text-red-600 mt-1 block">
            {state.fieldErrors.bio}
          </span>
        ) : null}
      </label>

      <label className="text-sm">
        <span className="block text-stone-700 mb-1 font-medium">
          Cover photo URL
        </span>
        <input
          name="coverPhotoUrl"
          type="url"
          inputMode="url"
          defaultValue={state.values.coverPhotoUrl}
          placeholder="https://…"
          className={fieldClass(state.fieldErrors.coverPhotoUrl)}
        />
        {state.fieldErrors.coverPhotoUrl ? (
          <span className="text-xs text-red-600 mt-1 block">
            {state.fieldErrors.coverPhotoUrl}
          </span>
        ) : null}
      </label>

      <label className="text-sm">
        <span className="block text-stone-700 mb-1 font-medium">
          Pickup window
        </span>
        <input
          name="pickupWindowText"
          type="text"
          maxLength={200}
          defaultValue={state.values.pickupWindowText}
          placeholder="e.g. Saturdays 9–11am"
          className={fieldClass(state.fieldErrors.pickupWindowText)}
        />
        {state.fieldErrors.pickupWindowText ? (
          <span className="text-xs text-red-600 mt-1 block">
            {state.fieldErrors.pickupWindowText}
          </span>
        ) : null}
      </label>

      <button
        type="submit"
        disabled={pending}
        className="self-start bg-stone-900 text-white rounded-md px-4 py-2 hover:bg-stone-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {pending ? "Claiming…" : "Claim baker capability"}
      </button>
    </form>
  );
}
