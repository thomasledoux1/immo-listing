'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Home, MapPin, Ruler, Trees, Trash2 } from 'lucide-react';

type ListingRow = {
  id: number;
  url: string;
  title: string;
  price: number;
  bedrooms: number | null;
  livingSurfaceM2: number | null;
  hasGarden: boolean;
  municipality: string | null;
  imageUrl: string | null;
  firstSeenAt: string;
  agencyName: string;
  agencySlug: string;
};

export function ListingCard({ listing }: { listing: ListingRow }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const priceFormatted = new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(listing.price);

  return (
    <Card className="overflow-hidden pt-0 transition-shadow duration-200 hover:shadow-lg">
      <div className="relative aspect-4/3 w-full shrink-0 rounded-t-lg overflow-hidden bg-muted">
        {listing.imageUrl ? (
          <Link
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block size-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={listing.imageUrl}
              alt=""
              className="size-full object-cover object-center absolute"
            />
          </Link>
        ) : (
          <Link
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-full items-center justify-center text-muted-foreground"
          >
            <span className="text-sm">No image</span>
          </Link>
        )}
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="line-clamp-2 text-lg">{listing.title}</CardTitle>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
          {listing.municipality && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5 shrink-0" />
              {listing.municipality}
            </span>
          )}
          <span>{listing.agencyName}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 pb-2">
        <span className="font-semibold text-primary">{priceFormatted}</span>
        {listing.bedrooms != null && (
          <Badge variant="secondary" className="gap-1">
            <Home className="size-3" />
            {listing.bedrooms} bed
          </Badge>
        )}
        {listing.livingSurfaceM2 != null && (
          <Badge variant="secondary" className="gap-1">
            <Ruler className="size-3" />
            {listing.livingSurfaceM2} m²
          </Badge>
        )}
        {listing.hasGarden && (
          <Badge variant="secondary" className="gap-1">
            <Trees className="size-3" />
            Garden
          </Badge>
        )}
      </CardContent>
      <CardFooter className="pt-2">
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer gap-1.5 border-destructive bg-transparent text-destructive hover:bg-destructive hover:text-white"
          disabled={deleting}
          onClick={async () => {
            if (deleting || !confirm("Delete this listing?")) return;
            setDeleting(true);
            try {
              const res = await fetch(`/api/listings/${listing.id}`, {
                method: "DELETE",
              });
              if (res.ok) router.refresh();
            } finally {
              setDeleting(false);
            }
          }}
          aria-label="Delete listing"
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
