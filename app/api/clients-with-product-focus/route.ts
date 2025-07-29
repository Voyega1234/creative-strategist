import { NextResponse } from 'next/server';
import { getClientsWithProductFocus } from '@/lib/data/clients';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const clients = await getClientsWithProductFocus();
    console.log('[clients-with-product-focus] Returning', clients.length, 'clients');
    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error fetching clients with product focus:', error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}