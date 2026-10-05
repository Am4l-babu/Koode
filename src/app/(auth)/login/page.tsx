import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default function LoginPage() {
  return (
    <div className="card mx-auto max-w-md p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <p className="mt-1 text-muted">Log in to give, track donations or manage your organisation&apos;s requests.</p>
      <div className="mt-6"><Suspense><LoginForm /></Suspense></div>
    </div>
  );
}
