import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { listings } from '@/db/schema';
import { NextResponse } from 'next/server';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const listingId = parseInt(id, 10);
  if (Number.isNaN(listingId) || listingId < 1) {
    return NextResponse.json({ error: 'Invalid listing id' }, { status: 400 });
  }

  const updated = await db
    .update(listings)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(listings.id, listingId))
    .returning({ id: listings.id });

  if (updated.length === 0) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
