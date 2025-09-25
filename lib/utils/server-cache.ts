// Server-side in-memory cache for database queries
interface ServerCacheEntry<T> {
  data: T
  timestamp: number
  expiresIn: number
}

class ServerCache {
  private static instance: ServerCache
  private cache = new Map<string, ServerCacheEntry<any>>()

  static getInstance(): ServerCache {
    if (!ServerCache.instance) {
      ServerCache.instance = new ServerCache()
    }
    return ServerCache.instance
  }

  set<T>(key: string, data: T, expiresInMs: number = 2 * 60 * 1000): void {
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

  clearByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
      }
    }
  }

  // Cached execution wrapper
  async cachedExecution<T>(
    key: string, 
    executor: () => Promise<T>, 
    expiresInMs: number = 2 * 60 * 1000
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(key)
    if (cached !== null) {
      console.log(`Server cache hit for key: ${key}`)
      return cached
    }

    // Execute fresh query
    console.log(`Server cache miss for key: ${key}, executing fresh query`)
    try {
      const data = await executor()
      this.set(key, data, expiresInMs)
      return data
    } catch (error) {
      console.error(`Error executing query for key ${key}:`, error)
      throw error
    }
  }

  // Get cache statistics for debugging
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        age: Date.now() - entry.timestamp,
        expiresIn: entry.expiresIn
      }))
    }
  }
}

// Export singleton instance
export const serverCache = ServerCache.getInstance()

// Convenient wrapper for database operations
export async function cachedQuery<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  expiresInMs: number = 2 * 60 * 1000
): Promise<T> {
  return serverCache.cachedExecution(cacheKey, queryFn, expiresInMs)
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    serverCache.clear()
    return
  }
  serverCache.clearByPrefix(prefix)
}
