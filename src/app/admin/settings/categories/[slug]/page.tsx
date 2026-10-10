import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { CategoryIcon } from "@/components/brand/category-visual";
import { Badge } from "@/components/ui/badge";
import { ProductTypeEditor } from "@/components/admin/product-type-editor";
import { requirePagePermission } from "@/lib/auth/guards";
import { getCategoryForEditing } from "@/services/admin";

export const metadata = { title: "Product types" };

export default async function CategoryProductTypesPage({ params }: { params: Promise<{ slug: string }> }) {
  await requirePagePermission("SYSTEM_SETTINGS");
  const { slug } = await params;
  if (!/^[a-z][a-z0-9-]{1,30}$/.test(slug)) notFound();
  const category = await getCategoryForEditing(slug);
  if (!category) notFound();
  return (
    <>
      <Link href="/admin/settings" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Settings</Link>
      <PageHeader
        eyebrow={<><CategoryIcon slug={category.slug} emoji={category.icon} className="h-7 w-7 rounded-lg" iconClassName="h-4 w-4" />{category.name}</>}
        title="Product types"
        description="What organisations can pick when they ask for an item, and the measurements and details each one needs. Changes apply to new requests and donations straight away."
        actions={!category.isActive ? <Badge>Inactive category</Badge> : undefined}
      />
      <ProductTypeEditor
        slug={category.slug}
        categoryName={category.name}
        categoryFields={category.fields}
        initial={category.productTypes}
        customised={category.customised}
        hasBuiltIn={category.hasBuiltIn}
        usage={category.usage}
      />
    </>
  );
}
