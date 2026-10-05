import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmail } from "@/components/auth/simple-forms";

export const metadata: Metadata = { title: "Confirm email", robots: { index: false } };

export default function VerifyEmailPage() {
  return (
    <div className="card mx-auto max-w-md p-6 sm:p-8">
      <h1 className="mb-4 text-2xl font-semibold">Email confirmation</h1>
      <Suspense><VerifyEmail /></Suspense>
    </div>
  );
}
