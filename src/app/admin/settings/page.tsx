import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryCreator, DataTools, SettingsForm } from "@/components/admin/actions";
import { requirePageUser } from "@/lib/auth/guards";
import { effectivePermissions, hasPermission, PERMISSION_LABELS } from "@/lib/permissions";
import { getSettings } from "@/services/settings";
import { listCategories } from "@/services/requests";
import { resolveCategorySchema } from "@/lib/categories";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requirePageUser(["ADMIN", "SUPER_ADMIN"]);
  const [settings, categories] = await Promise.all([getSettings(), listCategories(true)]);
  const canEdit = hasPermission(user, "SYSTEM_SETTINGS");
  return (
    <>
      <PageHeader eyebrow="Settings" title="Platform settings" />
      <section className="card mb-6 p-5">
        <p className="font-semibold">Your permissions</p>
        <div className="mt-3 flex flex-wrap gap-1.5">{[...effectivePermissions(user)].map((p) => <Badge key={p} tone="primary">{PERMISSION_LABELS[p]}</Badge>)}</div>
      </section>
      <SettingsForm initial={settings} canEdit={canEdit} />
      <h2 className="mb-3 mt-10 text-xl font-semibold">Categories</h2>
      <div className="grid gap-6 lg:grid-cols-2">
        <ul className="card divide-y divide-line">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <span><span aria-hidden="true">{c.icon}</span> <span className="font-semibold">{c.name}</span> <span className="font-mono text-xs text-subtle">/{c.slug}</span></span>
              <span className="text-xs text-muted">{categorySummary(c.slug, c.fieldSchema)}{!c.isActive && " · inactive"}</span>
            </li>
          ))}
        </ul>
        {canEdit && <CategoryCreator />}
      </div>
      {canEdit && <div className="mt-10"><DataTools /></div>}
    </>
  );
}

function categorySummary(slug: string, fieldSchema: unknown) {
  const schema = resolveCategorySchema(slug, fieldSchema);
  const fields = schema.fields.map((f) => f.key).join(", ") || "no fields";
  return schema.productTypes?.length ? `${fields} · ${schema.productTypes.length} product types` : fields;
}
