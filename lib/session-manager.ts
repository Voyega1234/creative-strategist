// High-performance session management with browser caching
class SessionManager {
  private static instance: SessionManager
  private sessionId: string | null = null
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>()

  private constructor() {
    // Initialize session ID from browser
    if (typeof window !== 'undefined') {
      this.sessionId = this.getOrCreateSessionId()
    }
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager()
    }
    return SessionManager.instance
  }

  private getOrCreateSessionId(): string {
    const STORAGE_KEY = 'cvc_session_id'
    let sessionId = localStorage.getItem(STORAGE_KEY)
    
    if (!sessionId) {
      // Generate unique session ID
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      localStorage.setItem(STORAGE_KEY, sessionId)
    }
    
    return sessionId
  }

  getSessionId(): string {
    if (!this.sessionId && typeof window !== 'undefined') {
      this.sessionId = this.getOrCreateSessionId()
    }
    return this.sessionId || ''
  }

  // Fast cache operations
  setCache(key: string, data: any, ttlMs: number = 60000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    })
  }

  getCache(key: string): any | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    const isExpired = Date.now() - cached.timestamp > cached.ttl
    if (isExpired) {
      this.cache.delete(key)
      return null
    }

    return cached.data
  }

  clearCache(): void {
    this.cache.clear()
  }

  // Fast session save (with debouncing)
  private saveTimeouts = new Map<string, NodeJS.Timeout>()

  async saveSession(data: {
    clientName: string
    productFocus: string
    n8nResponse: any
    userInput?: string
    selectedTemplate?: string
    modelUsed?: string
  }): Promise<boolean> {
    const cacheKey = `save_${data.clientName}_${data.productFocus}`
    
    // Clear existing timeout
    const existingTimeout = this.saveTimeouts.get(cacheKey)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Debounce save operations (wait 1 second)
    return new Promise((resolve) => {
      const timeout = setTimeout(async () => {
        try {
          const payload = {
            ...data,
            sessionId: this.getSessionId()
          }
          
          console.log('🔄 Attempting to save session:', {
            clientName: payload.clientName,
            productFocus: payload.productFocus,
            sessionId: payload.sessionId,
            hasN8nResponse: !!payload.n8nResponse,
            ideasCount: payload.n8nResponse?.ideas?.length || 0
          })

          const response = await fetch('/api/save-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })

          const result = await response.json()
          
          if (result.success) {
            // Cache the saved session
            this.setCache(`session_${result.sessionId}`, result, 300000) // 5 min cache
            console.log(`✅ Session saved successfully in ${result.processingTime}ms`, {
              sessionId: result.sessionId,
              createdAt: result.createdAt
            })
          } else {
            console.error('❌ Session save failed:', result.error)
          }

          resolve(result.success)
        } catch (error) {
          console.error('❌ Session save network error:', error)
          resolve(false)
        } finally {
          this.saveTimeouts.delete(cacheKey)
        }
      }, 1000)

      this.saveTimeouts.set(cacheKey, timeout)
    })
  }

  // Fast history loading with caching
  async getHistory(options: {
    clientName?: string
    limit?: number
    offset?: number
  } = {}): Promise<any> {
    const cacheKey = `history_${this.getSessionId()}_${JSON.stringify(options)}`
    
    // Check cache first
    const cached = this.getCache(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const params = new URLSearchParams({
        limit: (options.limit || 20).toString(),
        offset: (options.offset || 0).toString()
      })

      // Only add sessionId if we want sessions for a specific session
      // For getting all client sessions, we'll use clientName only
      if (options.clientName) {
        params.append('clientName', options.clientName)
      } else {
        // If no clientName provided, filter by sessionId
        params.append('sessionId', this.getSessionId())
      }

      const response = await fetch(`/api/session-history?${params}`)
      const result = await response.json()

      if (result.success) {
        // Cache for 1 minute
        this.setCache(cacheKey, result, 60000)
      }

      return result
    } catch (error) {
      console.error('History fetch error:', error)
      return { success: false, error: 'Failed to fetch history' }
    }
  }
}

export const sessionManager = SessionManager.getInstance()