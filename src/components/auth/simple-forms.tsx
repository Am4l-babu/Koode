"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Callout } from "@/components/ui/states";
import { api, ApiError } from "@/lib/client-api";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setError(null);
    try {
      await api("/api/auth/forgot-password", { body: { email } });
      setState("sent");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something didn't go as planned.");
      setState("idle");
    }
  }
  if (state === "sent") return <Callout tone="success" title="Check your inbox">If an account exists for that email, a reset link is on its way. It expires in one hour.</Callout>;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="fp-email"><Input id="fp-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      {error && <Callout tone="danger" title={error} />}
      <Button type="submit" size="lg" className="w-full" loading={state === "loading"}>Send reset link</Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/reset-password", { body: { token, password } });
      router.push("/login?reset=1");
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldError(err.fields.password);
        setError(err.fields.password ? null : err.message);
      }
      setLoading(false);
    }
  }
  if (!token) return <Callout tone="warning" title="This reset link is incomplete.">Request a new link from the forgot-password page.</Callout>;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="New password" htmlFor="new-password" error={fieldError} help="At least 10 characters with a letter and a number.">
        <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!fieldError} />
      </Field>
      {error && <Callout tone="danger" title={error} />}
      <Button type="submit" size="lg" className="w-full" loading={loading}>Update password</Button>
    </form>
  );
}

export function VerifyEmail() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) {
      setState("error");
      setMessage("This confirmation link is incomplete.");
      return;
    }
    api<{ message: string }>("/api/auth/verify-email", { body: { token } })
      .then((r) => {
        setState("ok");
        setMessage(r.message);
      })
      .catch((e) => {
        setState("error");
        setMessage(e instanceof ApiError ? e.message : "Something didn't go as planned.");
      });
  }, [token]);
  if (state === "loading") return <p className="text-muted">Confirming your email…</p>;
  return (
    <div className="space-y-4">
      <Callout tone={state === "ok" ? "success" : "danger"} title={message} />
      <Link href="/dashboard" className={buttonClass("primary", "md")}>Go to dashboard</Link>
    </div>
  );
}
