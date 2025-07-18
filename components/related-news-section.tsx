"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Loader2, Newspaper, ExternalLink, Sparkles, ChevronDown, ChevronUp, Trash2 } from "lucide-react"

interface NewsArticle {
  id: string
  title: string
  description: string
  date: string
  is_sponsored: boolean
}

interface RelatedNewsSectionProps {
  clientName: string
  productFocus: string
}

export function RelatedNewsSection({ clientName, productFocus }: RelatedNewsSectionProps) {
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessed, setIsProcessed] = useState(false)
  const [fromCache, setFromCache] = useState(false)
  const [error, setError] = useState('')
  const [latestDate, setLatestDate] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [deletingArticles, setDeletingArticles] = useState<Set<string>>(new Set())

  // Check if already processed on mount
  useEffect(() => {
    if (clientName && productFocus && clientName !== "No Client Selected") {
      checkExistingNews()
    }
  }, [clientName, productFocus])

  const checkExistingNews = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/process-related-news', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientName,
          productFocus
        }),
      })

      const data = await response.json()
      
      if (data.success && data.relatedNews.length > 0) {
        setNewsArticles(data.relatedNews)
        setIsProcessed(true)
        setFromCache(data.fromCache)
        setLatestDate(data.latestDate)
      } else {
        setIsProcessed(false)
      }
    } catch (error) {
      console.error('Error checking existing news:', error)
      setIsProcessed(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleProcessRelatedNews = async (forceRefresh = false) => {
    if (!clientName || !productFocus || clientName === "No Client Selected") {
      setError('กรุณาเลือกลูกค้าและ Product Focus ก่อน')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/process-related-news', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientName,
          productFocus,
          forceRefresh
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        setNewsArticles(data.relatedNews)
        setIsProcessed(true)
        setFromCache(data.fromCache)
        setLatestDate(data.latestDate)
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการประมวลผลข่าว')
      }
    } catch (error) {
      console.error('Error processing related news:', error)
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteArticle = async (articleId: string) => {
    if (!clientName || !productFocus) return

    // Add to deleting set
    setDeletingArticles(prev => new Set(prev).add(articleId))

    try {
      const response = await fetch('/api/delete-news-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleId,
          clientName,
          productFocus
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        // Remove from local state
        setNewsArticles(prev => prev.filter(article => article.id !== articleId))
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการลบข่าว')
      }
    } catch (error) {
      console.error('Error deleting article:', error)
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง')
    } finally {
      // Remove from deleting set
      setDeletingArticles(prev => {
        const newSet = new Set(prev)
        newSet.delete(articleId)
        return newSet
      })
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return null
      }
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch (error) {
      return null
    }
  }

  const displayedArticles = showAll ? newsArticles : newsArticles.slice(0, 3)
  const hasMoreArticles = newsArticles.length > 3

  if (!clientName || clientName === "No Client Selected" || !productFocus) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-[#d1d1d6]">
        <div className="flex items-center gap-2 mb-4">
          <Newspaper className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-500">Related News</h3>
        </div>
        <p className="text-sm text-gray-500">เลือกลูกค้าและ Product Focus เพื่อดูข่าวที่เกี่ยวข้อง</p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-[#d1d1d6]">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-gray-700" />
            <h3 className="text-lg font-semibold">Related News</h3>
            {fromCache && (
              <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                จากแคช
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {!isProcessed && (
              <Button
                onClick={handleProcessRelatedNews}
                disabled={isLoading}
                className="bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:from-purple-700 hover:to-purple-600"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    กำลังประมวลผล...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    ค้นหาข่าวที่เกี่ยวข้อง
                  </>
                )}
              </Button>
            )}
            {isProcessed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleProcessRelatedNews(true)}
                    disabled={isLoading}
                    className="text-xs"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 mr-1" />
                        Update News
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>หากคลิกปุ่มนี้จะทำการค้นหาข่าวใหม่อีกครั้ง</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        {latestDate && (
          <div className="text-sm text-gray-500 mt-2">
            ข้อมูลล่าสุด ณ วันที่ {formatDate(latestDate)}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {isLoading && !newsArticles.length && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 h-4 rounded w-3/4 mb-2"></div>
              <div className="bg-gray-200 h-3 rounded w-full mb-1"></div>
              <div className="bg-gray-200 h-3 rounded w-5/6"></div>
            </div>
          ))}
        </div>
      )}

      {isProcessed && newsArticles.length > 0 && (
        <div className="space-y-4">
          <div className={`space-y-3 ${!showAll && newsArticles.length > 3 ? 'max-h-96 overflow-y-auto' : ''}`}>
            {displayedArticles.map((article) => (
              <Card key={article.id} className="p-4 border border-gray-200 hover:border-gray-300 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {article.is_sponsored && (
                        <Badge variant="secondary" className="text-xs">
                          สปอนเซอร์
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-medium text-gray-900 mb-2 leading-tight">
                      {article.title}
                    </h4>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {article.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0"
                      onClick={() => {
                        // You can add click tracking or navigation here
                        console.log('News article clicked:', article.id)
                      }}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteArticle(article.id)}
                      disabled={deletingArticles.has(article.id)}
                    >
                      {deletingArticles.has(article.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          
          {hasMoreArticles && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => setShowAll(!showAll)}
                className="flex items-center gap-2 hover:bg-gray-50"
              >
                {showAll ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    ย่อข่าว
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    ดูข่าวทั้งหมด ({newsArticles.length} ข่าว)
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {isProcessed && newsArticles.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Newspaper className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p>ไม่พบข่าวที่เกี่ยวข้องสำหรับ {clientName} - {productFocus}</p>
        </div>
      )}

    </div>
    </TooltipProvider>
  )
}