import { PageHeader } from "@/components/ui/card";
import { RequestWizard } from "@/components/recipient/request-wizard";
import { requirePageUser } from "@/lib/auth/guards";
import { listCategories } from "@/services/requests";
import { getOwnOrganization } from "@/services/organizations";
import { getSettings } from "@/services/settings";
import { parseCategorySchema } from "@/lib/categories";

export const metadata = { title: "Create request" };

export default async function NewRequestPage() {
  const user = await requirePageUser(["RECIPIENT"]);
  const [categories, org, settings] = await Promise.all([listCategories(), getOwnOrganization(user), getSettings()]);
  return (
    <>
      <PageHeader eyebrow="New request" title="Request what you actually need" description="A few simple steps. Your organisation stays anonymous to donors." />
      <RequestWizard
        categories={categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, icon: c.icon, description: c.description, fieldSchema: parseCategorySchema(c.fieldSchema) }))}
        defaultDistrict={org.district}
        recurringEnabled={settings.features.recurringRequests}
      />
    </>
  );
}
