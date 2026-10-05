import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/simple-forms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <div className="card mx-auto max-w-md p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <p className="mt-1 text-muted">You&apos;ll be signed out of other devices.</p>
      <div className="mt-6"><Suspense><ResetPasswordForm /></Suspense></div>
    </div>
  );
}
