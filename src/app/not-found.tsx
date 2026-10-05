import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <EmptyState illustration="box" title="We couldn't find that page" description="It may have been fulfilled, closed or moved." action={<ButtonLink href="/needs">Browse needs</ButtonLink>} />
    </div>
  );
}
