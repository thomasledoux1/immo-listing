import { getListings } from '@/lib/queries';
import { ListingCard } from '@/components/listing-card';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Ghent Immo – Listings',
  description: 'All listings from partner agencies in Ghent.',
};

function normalizeAddress(addr: string): string {
  return addr.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** True if address looks like a street address with a house number (e.g. "Korte Meer 12"), not just a municipality ("Gent", "9000 Gent"). */
function hasHouseNumber(addr: string): boolean {
  return /[A-Za-zÀ-ÿ]\s+\d+[A-Za-z]?\b/.test(addr.trim());
}

/** Keep one listing per address; listings without address or with only municipality are left as-is. */
function dedupeByAddress<T extends { address?: string | null }>(rows: T[]): T[] {
  const seenAddresses = new Set<string>();
  return rows.filter((row) => {
    const addr = row.address?.trim();
    if (!addr) return true;
    if (!hasHouseNumber(addr)) return true;
    const key = normalizeAddress(addr);
    if (seenAddresses.has(key)) return false;
    seenAddresses.add(key);
    return true;
  });
}

export default async function Home() {
  const allListings = await getListings();
  const listings = dedupeByAddress(allListings);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-6 md:px-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Ghent Immo
        </h1>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        {listings.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-16 text-center">
            <p className="text-muted-foreground">
              No listings yet. Run the scraper to backfill data.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map(listing => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
