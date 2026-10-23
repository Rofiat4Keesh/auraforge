"use client";

/**
 * Sign in / Quick sign-up form, used by the account page and the checkout sign-in step.
 * New accounts are always CUSTOMER; admins are promoted with `npm run seed:admin`.
 */
import { useState, type FormEvent } from "react";
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ApiClientError } from "@/lib/api-client";
import type { SessionUserDTO } from "@/types";

export type AuthMode = "login" | "register";
type Field = "fullName" | "email" | "phone" | "password";
type Errors = Partial<Record<Field, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9 ]{10,16}$/;

function validate(mode: AuthMode, form: Record<Field, string>): Errors {
  const errors: Errors = {};
  if (!EMAIL_RE.test(form.email.trim())) errors.email = "Enter a valid email address";
  if (mode === "login") {
    if (!form.password) errors.password = "Enter your password";
    return errors;
  }
  if (form.fullName.trim().length < 2) errors.fullName = "Enter your full name";
  if (form.phone.trim() && !PHONE_RE.test(form.phone.trim())) errors.phone = "Enter a valid phone number, e.g. 0803 000 0000";
  if (form.password.length < 8) errors.password = "Use at least 8 characters";
  return errors;
}

export function AuthForm({
  idPrefix,
  initialMode = "login",
  submitLabels = { login: "Sign in", register: "Create account" },
  onSuccess,
}: {
  /** Prefix for input ids, so two forms on a page never share an id. */
  idPrefix: string;
  initialMode?: AuthMode;
  submitLabels?: { login: string; register: string };
  onSuccess: (user: SessionUserDTO) => void | Promise<void>;
}) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [form, setForm] = useState<Record<Field, string>>({ fullName: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<{ text: string; status: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const id = (field: Field) => `${idPrefix}-${field}`;

  function switchMode(next: AuthMode) {
    setMode(next);
    setErrors({});
    setMessage(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const found = validate(mode, form);
    setErrors(found);
    const first = (Object.keys(found) as Field[])[0];
    if (first) {
      document.getElementById(id(first))?.focus();
      return;
    }
    setBusy(true);
    try {
      const user =
        mode === "login"
          ? await signIn({ email: form.email.trim(), password: form.password })
          : await signUp({ fullName: form.fullName.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password });
      await onSuccess(user);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setMessage({ text: error.message, status: error.status });
        const fieldErrors: Errors = {};
        for (const [key, value] of Object.entries(error.fieldErrors)) {
          if (Array.isArray(value) && value[0] && ["fullName", "email", "phone", "password"].includes(key)) fieldErrors[key as Field] = value[0];
        }
        setErrors(fieldErrors);
      } else {
        setMessage({ text: "Something went wrong. Please try again.", status: 0 });
      }
    } finally {
      setBusy(false);
    }
  }

  const input = (field: Field, label: string, props: { type?: string; autoComplete: string; placeholder?: string; inputMode?: "email" | "tel" }, optional = false) => (
    <div>
      <label htmlFor={id(field)} className="label">
        {label}
        {optional && <span className="normal-case tracking-normal text-ink-500"> (optional)</span>}
      </label>
      <input
        id={id(field)}
        name={field}
        value={form[field]}
        onChange={(e) => {
          const value = e.target.value;
          setForm((f) => ({ ...f, [field]: value }));
          if (errors[field]) setErrors((x) => ({ ...x, [field]: undefined }));
        }}
        className={`input ${errors[field] ? "border-neon-magenta focus:border-neon-magenta focus:ring-neon-magenta/20" : ""}`}
        aria-invalid={Boolean(errors[field])}
        aria-describedby={errors[field] ? `${id(field)}-error` : undefined}
        {...props}
      />
      {errors[field] && (
        <p id={`${id(field)}-error`} className="mt-1.5 text-xs text-neon-magenta">
          {errors[field]}
        </p>
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 rounded-xl border border-obsidian-700 bg-obsidian-950 p-1" role="tablist" aria-label="Sign in or create an account">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={`rounded-lg py-2 text-sm font-medium transition ${mode === m ? "bg-neon-cyan text-obsidian-950" : "text-ink-400 hover:text-ink-100"}`}
          >
            {m === "login" ? "Sign in" : "Quick sign-up"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4" noValidate>
        {mode === "register" && input("fullName", "Full name", { autoComplete: "name" })}
        {input("email", "Email address", { type: "email", autoComplete: "email", inputMode: "email" })}
        {mode === "register" && input("phone", "Phone", { type: "tel", autoComplete: "tel", inputMode: "tel", placeholder: "0803 000 0000" }, true)}
        <div>
          <label htmlFor={id("password")} className="label">
            Password
          </label>
          <div className="relative">
            <input
              id={id("password")}
              name="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => {
                const value = e.target.value;
                setForm((f) => ({ ...f, password: value }));
                if (errors.password) setErrors((x) => ({ ...x, password: undefined }));
              }}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className={`input pr-12 ${errors.password ? "border-neon-magenta" : ""}`}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? `${id("password")}-error` : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-400 hover:text-neon-cyan"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password ? (
            <p id={`${id("password")}-error`} className="mt-1.5 text-xs text-neon-magenta">
              {errors.password}
            </p>
          ) : mode === "register" ? (
            <p className="mt-1.5 text-xs text-ink-500">At least 8 characters.</p>
          ) : null}
        </div>

        {message && (
          <div className="flex gap-2 rounded-lg border border-neon-magenta/40 bg-neon-magenta/5 p-3 text-sm text-neon-magenta" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {message.text}{" "}
              {message.status === 409 && (
                <button type="button" onClick={() => switchMode("login")} className="font-semibold underline">
                  Sign in instead
                </button>
              )}
              {message.status === 401 && mode === "login" && (
                <button type="button" onClick={() => switchMode("register")} className="font-semibold underline">
                  New here? Create an account
                </button>
              )}
            </p>
          </div>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "login" ? submitLabels.login : submitLabels.register}
        </button>
      </form>
    </div>
  );
}
