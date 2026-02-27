import { getListings } from '@/lib/queries';
import { ListingCard } from '@/components/listing-card';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Ghent Immo – Listings',
  description: 'All listings from partner agencies in Ghent.',
};

export default async function Home() {
  const listings = await getListings();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-6 md:px-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Ghent Immo – Listings
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
