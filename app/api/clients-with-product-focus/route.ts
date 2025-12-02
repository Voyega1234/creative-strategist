import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// In-memory cache for clients data with better structure
let clientsCache: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute cache
const MAX_CACHE_AGE = 300000; // 5 minutes max before forced refresh

export async function GET() {
  const startTime = performance.now();
  
  try {
    const cacheAge = Date.now() - cacheTimestamp;
    
    // Check cache first - return immediately if fresh
    if (clientsCache && cacheAge < CACHE_TTL) {
      console.log(`[clients-with-product-focus] Cache hit (${cacheAge}ms old) - ${performance.now() - startTime}ms`);
      return NextResponse.json(clientsCache);
    }
    
    // Force refresh if cache is too old
    if (cacheAge > MAX_CACHE_AGE) {
      console.log(`[clients-with-product-focus] Cache expired (${cacheAge}ms old), forcing refresh`);
      clientsCache = null;
    }

    const supabase = getSupabase();
    
    // OPTIMIZED: Use select with specific fields and better ordering
    const { data, error } = await supabase
      .from('Clients')
      .select('id, clientName, productFocus, color_palette')
      .not('clientName', 'is', null)
      .not('productFocus', 'is', null)
      .order('clientName')
      .order('productFocus');

    if (error) {
      console.error('Error fetching clients with product focus:', error);
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
    }

    // OPTIMIZED: Ultra-fast grouping with Set for deduplication
    const clientsMap = new Map();
    const seenProducts = new Set();
    
    const sanitizeColorValue = (value: string) =>
      value.replace(/[^0-9a-fA-F]/g, "").substring(0, 6).toUpperCase()

    const parseColorPalette = (paletteValue: any): string[] => {
      if (!paletteValue) return []
      if (Array.isArray(paletteValue))
        return paletteValue
          .map((value) => sanitizeColorValue(String(value)))
          .filter(Boolean)
      if (typeof paletteValue === 'string') {
        try {
          const parsed = JSON.parse(paletteValue)
          if (Array.isArray(parsed)) {
            return parsed
              .map((value) => sanitizeColorValue(String(value)))
              .filter(Boolean)
          }
        } catch {
          return paletteValue
            .split(',')
            .map((value) => sanitizeColorValue(value))
            .filter(Boolean)
        }
      }
      return []
    }

    data?.forEach(row => {
      const productKey = `${row.clientName}:${row.productFocus}`;
      
      // Skip if we've already seen this client-product combination
      if (seenProducts.has(productKey)) return;
      seenProducts.add(productKey);
      
      if (!clientsMap.has(row.clientName)) {
        clientsMap.set(row.clientName, {
          id: row.id,
          clientName: row.clientName,
          productFocuses: [],
          colorPalette: parseColorPalette(row.color_palette)
        });
      }
      
      clientsMap.get(row.clientName).productFocuses.push({
        id: row.id,
        productFocus: row.productFocus
      });
    });

    const clients = Array.from(clientsMap.values());
    
    // Cache the result
    clientsCache = clients;
    cacheTimestamp = Date.now();

    const endTime = performance.now();
    console.log(`[clients-with-product-focus] Query completed in ${endTime - startTime}ms for ${clients.length} clients`);
    
    // Return with optimized headers for client-side caching
    return NextResponse.json(clients, {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120',
        'X-Query-Time': `${endTime - startTime}ms`,
        'X-Client-Count': clients.length.toString(),
        'X-Cache-Status': cacheAge > 0 ? 'refreshed' : 'fresh'
      }
    });
  } catch (error) {
    const endTime = performance.now();
    console.error(`[clients-with-product-focus] Error after ${endTime - startTime}ms:`, error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

// POST method to clear cache
export async function POST() {
  try {
    clientsCache = null;
    cacheTimestamp = 0;
    console.log('[clients-with-product-focus] Cache cleared successfully');
    return NextResponse.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    console.error('[clients-with-product-focus] Error clearing cache:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to clear cache' 
    }, { status: 500 });
  }
}
