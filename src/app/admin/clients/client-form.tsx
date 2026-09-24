"use client";

import { useActionState } from "react";
import type { FormState } from "./actions";

type Values = {
  name?: string | null;
  email?: string | null;
  bookingEmails?: string | null;
  programName?: string | null;
  programStart?: string | null;
  programEnd?: string | null;
  stripeCustomerId?: string | null;
};

export function ClientForm({
  action,
  initial = {},
  submitLabel,
  clearOnSuccess = false,
  showStripe = false,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: Values;
  submitLabel: string;
  /** For the "add" form: start empty again after a successful save instead of showing the saved values. */
  clearOnSuccess?: boolean;
  showStripe?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const v: Values = state?.ok && clearOnSuccess ? {} : (state?.values ?? initial);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <Field label="Full name" name="name" defaultValue={v.name} required />
      <Field label="Sign-in email" name="email" type="email" defaultValue={v.email} required />
      <div className="sm:col-span-2">
        <label className="label" htmlFor="bookingEmails">
          Other booking emails (optional, one per line)
        </label>
        <textarea
          className="input min-h-[4.5rem]"
          id="bookingEmails"
          name="bookingEmails"
          defaultValue={v.bookingEmails ?? ""}
          placeholder="old-work-email@company.com"
        />
        <p className="mt-1 text-xs text-ink-faint">
          Sessions booked on Cal.com with any of these count as this client&apos;s. Only the sign-in email can sign in. If you
          change the sign-in email, the old one is kept here automatically.
        </p>
      </div>
      <Field label="Program name (optional)" name="programName" defaultValue={v.programName} />
      {showStripe && (
        <Field
          label="Stripe customer ID (optional, otherwise matched by email)"
          name="stripeCustomerId"
          defaultValue={v.stripeCustomerId}
          placeholder="cus_…"
        />
      )}
      {/* Billing is parked: keep any stored Stripe customer ID untouched on save. */}
      {!showStripe && <input type="hidden" name="stripeCustomerId" value={v.stripeCustomerId ?? ""} />}
      <Field label="Program start date" name="programStart" type="date" defaultValue={v.programStart} />
      <Field label="Program end date" name="programEnd" type="date" defaultValue={v.programEnd} />
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {state?.error && <p className="text-sm text-accent">{state.error}</p>}
        {state?.ok && <p className="text-sm text-ok">Saved.</p>}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input
        className="input"
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
}
