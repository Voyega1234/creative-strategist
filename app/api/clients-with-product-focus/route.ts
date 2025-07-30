import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// In-memory cache for clients data
let clientsCache: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 300000; // 5 minutes cache

export async function GET() {
  const startTime = performance.now();
  
  try {
    // Check cache first
    if (clientsCache && (Date.now() - cacheTimestamp) < CACHE_TTL) {
      console.log(`[clients-with-product-focus] Cache hit - ${performance.now() - startTime}ms`);
      return NextResponse.json(clientsCache);
    }

    const supabase = getSupabase();
    
    // OPTIMIZED: Use direct aggregated query instead of fetching all records
    const { data, error } = await supabase
      .from('AnalysisRun')
      .select('id, clientName, productFocus')
      .order('clientName')
      .limit(100); // Reasonable limit

    if (error) {
      console.error('Error fetching clients with product focus:', error);
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
    }

    // OPTIMIZED: Faster grouping algorithm
    const clientsMap = new Map();
    
    data?.forEach(row => {
      if (!clientsMap.has(row.clientName)) {
        clientsMap.set(row.clientName, {
          id: row.id,
          clientName: row.clientName,
          productFocuses: []
        });
      }
      
      const client = clientsMap.get(row.clientName);
      if (!client.productFocuses.some(pf => pf.productFocus === row.productFocus)) {
        client.productFocuses.push({
          id: row.id,
          productFocus: row.productFocus
        });
      }
    });

    const clients = Array.from(clientsMap.values());
    
    // Cache the result
    clientsCache = clients;
    cacheTimestamp = Date.now();

    const endTime = performance.now();
    console.log(`[clients-with-product-focus] Query completed in ${endTime - startTime}ms for ${clients.length} clients`);
    
    return NextResponse.json(clients);
  } catch (error) {
    const endTime = performance.now();
    console.error(`[clients-with-product-focus] Error after ${endTime - startTime}ms:`, error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}