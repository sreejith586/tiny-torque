import { createClient } from '@/lib/supabase/server';
import { listProposedModels, listAllBrands } from '@/domain/catalog';
import CatalogueProposals from '@/components/CatalogueProposals';

export default async function AdminCataloguePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [models, brands] = await Promise.all([
    listProposedModels(supabase),
    listAllBrands(supabase),
  ]);
  const brandNames = Object.fromEntries(brands.map((b) => [b.id, b.name]));

  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <h2 style={{ fontSize: 18 }}>Catalogue proposals</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Models proposed by AI scans or members, awaiting verification. (Merge-into-existing lands
        with S3-07 follow-up.)
      </p>
      <CatalogueProposals models={models} brandNames={brandNames} adminId={user!.id} />
    </div>
  );
}
