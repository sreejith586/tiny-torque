import { createClient } from '@/lib/supabase/server';
import { listProposedModels, listAllBrands, listModelsWithProposedSpecs } from '@/domain/catalog';
import CatalogueProposals from '@/components/CatalogueProposals';
import CatalogueSpecsEditor from '@/components/CatalogueSpecsEditor';

export default async function AdminCataloguePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [models, brands, specProposals] = await Promise.all([
    listProposedModels(supabase),
    listAllBrands(supabase),
    listModelsWithProposedSpecs(supabase),
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

      <h2 style={{ fontSize: 18, marginTop: 20 }}>Car specs awaiting verification</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Real-car performance specs proposed by members or AI scans (F-25 racing input). Saving marks
        them verified; only verified specs race.
      </p>
      {specProposals.length === 0 ? (
        <p className="muted">No spec proposals awaiting review.</p>
      ) : (
        specProposals.map((m) => (
          <div key={m.id} style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
            <span>
              <strong>{brandNames[m.brand_id] ?? '—'}</strong> · {m.name}
              {m.series ? ` · ${m.series}` : ''}
            </span>
            <CatalogueSpecsEditor model={m} />
          </div>
        ))
      )}
    </div>
  );
}
