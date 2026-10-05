import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default function RegisterPage() {
  return (
    <div className="card mx-auto max-w-2xl p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">Join the community</h1>
      <p className="mt-1 text-muted">Free for donors and verified organisations.</p>
      <div className="mt-6"><Suspense><RegisterForm /></Suspense></div>
    </div>
  );
}
