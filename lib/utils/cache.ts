// Simple in-memory cache for client-side data
interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresIn: number
}

class ClientCache {
  private cache = new Map<string, CacheEntry<any>>()

  set<T>(key: string, data: T, expiresInMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresIn: expiresInMs
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.expiresIn) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  clear(key?: string): void {
    if (key) {
      this.cache.delete(key)
    } else {
      this.cache.clear()
    }
  }

  // Cached fetch wrapper
  async cachedFetch<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    expiresInMs: number = 5 * 60 * 1000
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(key)
    if (cached !== null) {
      console.log(`Cache hit for key: ${key}`)
      return cached
    }

    // Fetch fresh data
    console.log(`Cache miss for key: ${key}, fetching fresh data`)
    try {
      const data = await fetcher()
      this.set(key, data, expiresInMs)
      return data
    } catch (error) {
      console.error(`Error fetching data for key ${key}:`, error)
      throw error
    }
  }
}

// Export singleton instance
export const clientCache = new ClientCache()

// Convenient wrapper for API calls
export async function cachedApiCall<T>(
  endpoint: string,
  options?: RequestInit,
  cacheKey?: string,
  expiresInMs?: number
): Promise<T> {
  const key = cacheKey || `api:${endpoint}:${JSON.stringify(options || {})}`
  
  return clientCache.cachedFetch<T>(
    key,
    async () => {
      const response = await fetch(endpoint, options)
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`)
      }
      return response.json()
    },
    expiresInMs
  )
}