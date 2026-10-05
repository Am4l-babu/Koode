import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/simple-forms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <div className="card mx-auto max-w-md p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <p className="mt-1 text-muted">We&apos;ll email you a secure link.</p>
      <div className="mt-6"><ForgotPasswordForm /></div>
    </div>
  );
}
