"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileUp, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Callout } from "@/components/ui/states";
import { api, ApiError } from "@/lib/client-api";

const KINDS = [
  ["REGISTRATION_CERTIFICATE", "Registration certificate"],
  ["AUTHORIZATION", "Authorisation document"],
  ["PROOF_OF_OPERATION", "Proof of operation"],
  ["SUPPORTING_EVIDENCE", "Supporting evidence"],
] as const;

export function VerificationPanel({ canSubmit }: { canSubmit: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<string>(KINDS[0][0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return setMsg({ tone: "danger", text: "Choose a file to upload." });
    if (file.size > 5 * 1024 * 1024) return setMsg({ tone: "danger", text: "Files must be 5 MB or smaller." });
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", kind);
    setBusy("upload");
    setMsg(null);
    try {
      await api("/api/organization/documents", { formData: fd });
      setMsg({ tone: "success", text: "Document uploaded securely." });
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (err) {
      setMsg({ tone: "danger", text: err instanceof ApiError ? err.message : "Upload failed." });
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    setBusy("submit");
    setMsg(null);
    try {
      await api("/api/organization/verification", { body: { note: note.trim() || undefined } });
      setMsg({ tone: "success", text: "Submitted! Our verification team will review your organisation." });
      router.refresh();
    } catch (err) {
      setMsg({ tone: "danger", text: err instanceof ApiError ? err.message : "Something didn't go as planned." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={upload} className="space-y-4 rounded-2xl border border-line p-5">
        <h3 className="font-semibold">Upload a document</h3>
        <p className="text-sm text-muted">PDF, PNG, JPEG or WEBP up to 5 MB. Stored in private storage — never publicly accessible.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Document type" htmlFor="doc-kind">
            <Select id="doc-kind" value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
          </Field>
          <Field label="File" htmlFor="doc-file">
            <input ref={fileRef} id="doc-file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="block w-full rounded-xl border border-line-strong bg-surface p-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:font-semibold file:text-primary-ink" />
          </Field>
        </div>
        <Button type="submit" variant="outline" icon={<FileUp className="h-4 w-4" />} loading={busy === "upload"}>Upload</Button>
      </form>
      {canSubmit && (
        <div className="space-y-4 rounded-2xl border border-line p-5">
          <h3 className="font-semibold">Submit for verification</h3>
          <Field label="Note for the review team (optional)" htmlFor="v-note"><Textarea id="v-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
          <Button icon={<Send className="h-4 w-4" />} onClick={submit} loading={busy === "submit"}>Submit for verification</Button>
        </div>
      )}
      {msg && <Callout tone={msg.tone} title={msg.text} />}
    </div>
  );
}
