"use client";

import { useActionState, useRef, useState } from "react";
import type { ScheduleFormState } from "./actions";

type Tag = {
  id: string;
  slug: string;
  label: string;
  kind: "style" | "dietary" | "ingredient" | "process" | "kitchen";
};

const inputBase =
  "w-full border rounded-md px-3 py-2 focus:outline-none focus:border-stone-500 bg-white";
const inputOk = "border-stone-300";
const inputBad = "border-red-400 focus:border-red-500";

function fieldClass(error?: string) {
  return `${inputBase} ${error ? inputBad : inputOk}`;
}

const DAYS: Array<{ value: number; short: string; long: string }> = [
  { value: 0, short: "Sun", long: "Sunday" },
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
];

// `<input type="datetime-local">` returns local-tz strings. Convert to UTC
// ISO so server interpretation doesn't depend on its timezone.
function localToIso(local: string): string {
  if (!local) return "";
  const ms = new Date(local).getTime();
  return Number.isNaN(ms) ? "" : new Date(ms).toISOString();
}

export type ScheduleFormProps = {
  action: (
    prev: ScheduleFormState,
    formData: FormData,
  ) => Promise<ScheduleFormState>;
  initialState: ScheduleFormState;
  allTags: Tag[];
  submitLabel: string;
  pendingLabel: string;
};

export function ScheduleForm({
  action,
  initialState,
  allTags,
  submitLabel,
  pendingLabel,
}: ScheduleFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [kind, setKind] = useState<"recurring" | "one_off">(
    state.values.kind,
  );

  const localInputRef = useRef<HTMLInputElement>(null);
  const isoInputRef = useRef<HTMLInputElement>(null);

  const lastLocalReady = state.values.firstReadyAt
    ? new Date(state.values.firstReadyAt).toISOString().slice(0, 16)
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

      <fieldset>
        <legend className="text-sm text-stone-700 mb-2 font-medium">
          Type <span className="text-red-600">*</span>
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <label
            className={`cursor-pointer rounded-lg border px-4 py-3 text-sm select-none ${
              kind === "recurring"
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-300 bg-white text-stone-700 hover:border-stone-500"
            }`}
          >
            <input
              type="radio"
              name="kind"
              value="recurring"
              className="sr-only"
              defaultChecked={kind === "recurring"}
              onChange={() => setKind("recurring")}
            />
            <span className="font-semibold">Recurring</span>
            <span className="block text-xs opacity-80 mt-0.5">
              Same days every week
            </span>
          </label>
          <label
            className={`cursor-pointer rounded-lg border px-4 py-3 text-sm select-none ${
              kind === "one_off"
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-300 bg-white text-stone-700 hover:border-stone-500"
            }`}
          >
            <input
              type="radio"
              name="kind"
              value="one_off"
              className="sr-only"
              defaultChecked={kind === "one_off"}
              onChange={() => setKind("one_off")}
            />
            <span className="font-semibold">One-off</span>
            <span className="block text-xs opacity-80 mt-0.5">
              Single planned bake
            </span>
          </label>
        </div>
      </fieldset>

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
          placeholder="One line. Description for the eater."
          className={fieldClass(state.fieldErrors.blurb)}
        />
        {state.fieldErrors.blurb ? (
          <span className="text-xs text-red-600 mt-1 block">
            {state.fieldErrors.blurb}
          </span>
        ) : null}
      </label>

      <label className="text-sm">
        <span className="block text-stone-700 mb-1 font-medium">Photo URL</span>
        <input
          name="photoUrl"
          type="url"
          inputMode="url"
          defaultValue={state.values.photoUrl}
          placeholder="https://…"
          className={fieldClass(state.fieldErrors.photoUrl)}
        />
        {state.fieldErrors.photoUrl ? (
          <span className="text-xs text-red-600 mt-1 block">
            {state.fieldErrors.photoUrl}
          </span>
        ) : null}
      </label>

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
            Default quantity <span className="text-red-600">*</span>
          </span>
          <input
            name="defaultQty"
            type="number"
            inputMode="numeric"
            required
            min={1}
            max={999}
            defaultValue={state.values.defaultQty}
            className={fieldClass(state.fieldErrors.defaultQty)}
          />
          {state.fieldErrors.defaultQty ? (
            <span className="text-xs text-red-600 mt-1 block">
              {state.fieldErrors.defaultQty}
            </span>
          ) : null}
        </label>
      </div>

      {kind === "recurring" ? (
        <RecurringFields state={state} />
      ) : (
        <OneOffFields
          state={state}
          lastLocalReady={lastLocalReady}
          localInputRef={localInputRef}
          isoInputRef={isoInputRef}
        />
      )}

      <fieldset className="text-sm">
        <legend className="text-stone-700 mb-2 font-medium">Tags</legend>
        <div className="space-y-3">
          {(Object.keys(tagsByKind) as Array<keyof typeof tagsByKind>).map(
            (kindKey) => (
              <div key={kindKey}>
                <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-1">
                  {kindKey}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tagsByKind[kindKey].map((t) => {
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
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}

function RecurringFields({ state }: { state: ScheduleFormState }) {
  return (
    <>
      <fieldset className="text-sm">
        <legend className="text-stone-700 mb-2 font-medium">
          Days of week <span className="text-red-600">*</span>
        </legend>
        <div className="flex flex-wrap gap-1.5" data-testid="days-of-week">
          {DAYS.map((d) => {
            const checked = state.values.daysOfWeek.includes(d.value);
            return (
              <label
                key={d.value}
                className="cursor-pointer text-xs rounded-full border border-stone-300 bg-white text-stone-700 hover:border-stone-500 px-3 py-1 transition select-none has-[:checked]:border-stone-900 has-[:checked]:bg-stone-900 has-[:checked]:text-white"
              >
                <input
                  type="checkbox"
                  name="daysOfWeek"
                  value={d.value}
                  defaultChecked={checked}
                  className="sr-only"
                />
                {d.short}
              </label>
            );
          })}
        </div>
        {state.fieldErrors.daysOfWeek ? (
          <span className="text-xs text-red-600 mt-2 block">
            {state.fieldErrors.daysOfWeek}
          </span>
        ) : null}
      </fieldset>

      <label className="text-sm">
        <span className="block text-stone-700 mb-1 font-medium">
          Time of day <span className="text-red-600">*</span>
        </span>
        <input
          name="timeOfDay"
          type="time"
          required
          defaultValue={state.values.timeOfDay}
          className={fieldClass(state.fieldErrors.timeOfDay)}
        />
        {state.fieldErrors.timeOfDay ? (
          <span className="text-xs text-red-600 mt-1 block">
            {state.fieldErrors.timeOfDay}
          </span>
        ) : null}
      </label>
    </>
  );
}

function OneOffFields({
  state,
  lastLocalReady,
  localInputRef,
  isoInputRef,
}: {
  state: ScheduleFormState;
  lastLocalReady: string;
  localInputRef: React.RefObject<HTMLInputElement | null>;
  isoInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <label className="text-sm">
      <span className="block text-stone-700 mb-1 font-medium">
        Ready at <span className="text-red-600">*</span>
      </span>
      <input
        ref={localInputRef}
        type="datetime-local"
        required
        defaultValue={lastLocalReady}
        onChange={(e) => {
          if (isoInputRef.current) {
            isoInputRef.current.value = localToIso(e.target.value);
          }
        }}
        className={fieldClass(state.fieldErrors.firstReadyAt)}
      />
      <input
        ref={isoInputRef}
        type="hidden"
        name="firstReadyAt"
        defaultValue={state.values.firstReadyAt}
      />
      {state.fieldErrors.firstReadyAt ? (
        <span className="text-xs text-red-600 mt-1 block">
          {state.fieldErrors.firstReadyAt}
        </span>
      ) : null}
    </label>
  );
}
