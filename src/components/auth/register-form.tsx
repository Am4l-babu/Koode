"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Building2, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Callout } from "@/components/ui/states";
import { cn } from "@/components/ui/cn";
import { api, ApiError } from "@/lib/client-api";
import { KERALA_DISTRICTS } from "@/lib/geo";
import { ORG_TYPE_LABELS } from "@/lib/descriptors";
import { safeNext } from "./login-form";

type Role = "DONOR" | "RECIPIENT";

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<Role>(params.get("role") === "recipient" ? "RECIPIENT" : "DONOR");
  const [values, setValues] = useState<Record<string, string>>({ orgType: "SCHOOL", district: "" });
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const started = useRef(Date.now());
  const honeypot = useRef<HTMLInputElement>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const err = (k: string) => errors[k];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setErrors({});
    const body: Record<string, unknown> = {
      role,
      fullName: values.fullName,
      email: values.email,
      password: values.password,
      phone: values.phone || undefined,
      district: values.district || undefined,
      acceptTerms: accept,
      website: honeypot.current?.value ?? "",
      formStartedAt: started.current,
    };
    if (role === "RECIPIENT") {
      Object.assign(body, {
        phone: values.phone,
        orgType: values.orgType,
        orgLegalName: values.orgLegalName,
        contactPerson: values.contactPerson || values.fullName,
        registrationNumber: values.registrationNumber || undefined,
        focusArea: values.focusArea || undefined,
        address: values.address,
        city: values.city,
        district: values.district,
        pinCode: values.pinCode,
      });
    }
    try {
      const res = await api<{ role: Role }>("/api/auth/register", { body });
      router.push(res.role === "RECIPIENT" ? "/recipient/verification?welcome=1" : safeNext(params.get("next"), "/donor?welcome=1"));
      router.refresh();
    } catch (e2) {
      if (e2 instanceof ApiError) {
        setErrors(e2.fields);
        setError(e2.message);
      } else setError("Something didn't go as planned.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">I want to…</legend>
        <div className="grid grid-cols-2 gap-2">
          {([
            ["DONOR", "Give items", "Donate anonymously", HeartHandshake],
            ["RECIPIENT", "Request support", "For organisations", Building2],
          ] as const).map(([r, t, d, Icon]) => (
            <label key={r} className={cn("flex cursor-pointer flex-col gap-1 rounded-2xl border p-4 transition-colors", role === r ? "border-primary bg-primary-soft" : "border-line hover:border-line-strong")}>
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
              <Icon className="h-5 w-5 text-primary-ink" aria-hidden="true" />
              <span className="font-semibold">{t}</span>
              <span className="text-xs text-muted">{d}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Honeypot — hidden from people and assistive tech */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input ref={honeypot} id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={role === "RECIPIENT" ? "Your name" : "Full name"} htmlFor="fullName" required error={err("fullName")} help="Private — never shown to anyone outside the platform team.">
          <Input id="fullName" autoComplete="name" value={values.fullName ?? ""} onChange={set("fullName")} invalid={!!err("fullName")} />
        </Field>
        <Field label="Email" htmlFor="reg-email" required error={err("email")}>
          <Input id="reg-email" type="email" autoComplete="email" value={values.email ?? ""} onChange={set("email")} invalid={!!err("email")} />
        </Field>
        <Field label="Password" htmlFor="reg-password" required error={err("password")} help="At least 10 characters with a letter and a number.">
          <Input id="reg-password" type="password" autoComplete="new-password" value={values.password ?? ""} onChange={set("password")} invalid={!!err("password")} />
        </Field>
        <Field label={role === "RECIPIENT" ? "Organisation phone" : "Phone (optional)"} htmlFor="phone" required={role === "RECIPIENT"} error={err("phone")}>
          <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" value={values.phone ?? ""} onChange={set("phone")} invalid={!!err("phone")} />
        </Field>
      </div>

      {role === "DONOR" ? (
        <Field label="Your district (optional)" htmlFor="district" help="Helps us suggest needs near you.">
          <Select id="district" value={values.district} onChange={set("district")}>
            <option value="">Prefer not to say</option>
            {KERALA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
        </Field>
      ) : (
        <div className="space-y-4 rounded-2xl border border-line bg-surface-2 p-4">
          <p className="text-sm text-muted">Organisation details are <strong className="text-fg">encrypted and visible only to the verification team</strong>. Donors see only a safe descriptor like “Verified Learning Center” and your district.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Organisation type" htmlFor="orgType" required error={err("orgType")}>
              <Select id="orgType" value={values.orgType} onChange={set("orgType")}>
                {Object.entries(ORG_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Registered name" htmlFor="orgLegalName" required error={err("orgLegalName")}>
              <Input id="orgLegalName" autoComplete="organization" value={values.orgLegalName ?? ""} onChange={set("orgLegalName")} invalid={!!err("orgLegalName")} />
            </Field>
            <Field label="Contact person" htmlFor="contactPerson" error={err("contactPerson")} help="Defaults to your name.">
              <Input id="contactPerson" value={values.contactPerson ?? ""} onChange={set("contactPerson")} />
            </Field>
            <Field label="Registration number" htmlFor="registrationNumber" error={err("registrationNumber")}>
              <Input id="registrationNumber" value={values.registrationNumber ?? ""} onChange={set("registrationNumber")} />
            </Field>
            <Field label="Focus area" htmlFor="focusArea" help="Shown publicly, e.g. “Children's Education”." error={err("focusArea")}>
              <Input id="focusArea" value={values.focusArea ?? ""} onChange={set("focusArea")} />
            </Field>
            <Field label="District" htmlFor="org-district" required error={err("district")}>
              <Select id="org-district" value={values.district} onChange={set("district")} invalid={!!err("district")}>
                <option value="">Choose a district</option>
                {KERALA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label="City / town" htmlFor="city" required error={err("city")}>
              <Input id="city" autoComplete="address-level2" value={values.city ?? ""} onChange={set("city")} invalid={!!err("city")} />
            </Field>
            <Field label="PIN code" htmlFor="pinCode" required error={err("pinCode")}>
              <Input id="pinCode" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={values.pinCode ?? ""} onChange={set("pinCode")} invalid={!!err("pinCode")} />
            </Field>
          </div>
          <Field label="Full address" htmlFor="address" required error={err("address")}>
            <Textarea id="address" rows={2} autoComplete="street-address" value={values.address ?? ""} onChange={set("address")} invalid={!!err("address")} />
          </Field>
        </div>
      )}

      <Checkbox
        label={<>I agree to the privacy terms: my identity is shared only with authorised platform administrators, and I will not try to identify {role === "DONOR" ? "recipients" : "donors"}.</>}
        checked={accept}
        onChange={(e) => setAccept(e.target.checked)}
      />
      {err("acceptTerms") && <p className="text-xs font-medium text-critical" role="alert">{err("acceptTerms")}</p>}
      {error && <Callout tone="danger" title={error} />}
      <Button type="submit" size="lg" className="w-full" loading={loading}>{role === "DONOR" ? "Create donor account" : "Apply as an organisation"}</Button>
      <p className="text-center text-sm text-muted">Already registered? <Link href="/login" className="font-semibold text-primary-ink hover:underline">Log in</Link></p>
    </form>
  );
}
