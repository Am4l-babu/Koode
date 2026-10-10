import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { BrowseView } from "@/components/needs/browse-view";
import { parseBrowseParams } from "@/lib/validation/browse";

export const metadata: Metadata = {
  title: "Browse verified community needs",
  description: "Search and filter verified needs from schools, children's homes, elder care homes and community organisations across Kerala.",
  alternates: { canonical: "/needs" },
};

export default async function NeedsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parseBrowseParams(await searchParams);
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader title="Browse Needs" description="Discover real needs from verified organisations and help make a difference." />
      <BrowseView query={query} basePath="/needs" />
    </div>
  );
}
