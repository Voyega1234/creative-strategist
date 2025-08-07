"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  History, 
  Clock, 
  User, 
  Target, 
  Sparkles, 
  ChevronRight,
  Calendar,
  TrendingUp,
  X
} from "lucide-react"
import { sessionManager } from "@/lib/session-manager"
import { format } from "date-fns"
import { th } from "date-fns/locale"

interface SessionHistoryItem {
  id: string
  clientName: string
  productFocus: string
  userInput?: string
  selectedTemplate?: string
  modelUsed: string
  ideasCount: number
  createdAt: string
  ideas: {
    title: string
    category: string
    impact: string
  }[]
}

interface SessionHistoryProps {
  isOpen: boolean
  onClose: () => void
  activeClientName?: string
}

export function SessionHistory({ isOpen, onClose, activeClientName }: SessionHistoryProps) {
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSession, setSelectedSession] = useState<SessionHistoryItem | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const ITEMS_PER_PAGE = 10

  // Fast loading with caching
  const loadHistory = useCallback(async (reset = false) => {
    setLoading(true)
    try {
      const currentOffset = reset ? 0 : offset
      
      const result = await sessionManager.getHistory({
        clientName: activeClientName,
        limit: ITEMS_PER_PAGE,
        offset: currentOffset
      })

      if (result.success) {
        if (reset) {
          setSessions(result.sessions)
          setOffset(ITEMS_PER_PAGE)
        } else {
          setSessions(prev => [...prev, ...result.sessions])
          setOffset(prev => prev + ITEMS_PER_PAGE)
        }
        
        setHasMore(result.hasMore)
      }
    } catch (error) {
      console.error('Failed to load history:', error)
    } finally {
      setLoading(false)
    }
  }, [activeClientName, offset])

  // Load initial data when modal opens
  useEffect(() => {
    if (isOpen) {
      setOffset(0)
      loadHistory(true)
    }
  }, [isOpen, activeClientName])

  // Group sessions by date for better UX
  const groupedSessions = sessions.reduce((groups, session) => {
    const date = format(new Date(session.createdAt), 'yyyy-MM-dd')
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(session)
    return groups
  }, {} as Record<string, SessionHistoryItem[]>)

  const handleSessionClick = (session: SessionHistoryItem) => {
    setSelectedSession(session)
    setDetailModalOpen(true)
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              ประวัติการสร้างไอเดีย (7 วันล่าสุด)
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-6 pt-2">
            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card className="p-4 bg-blue-50">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    รวม {sessions.length} เซสชัน
                  </span>
                </div>
              </Card>
              <Card className="p-4 bg-green-50">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">
                    {sessions.reduce((sum, s) => sum + s.ideasCount, 0)} ไอเดีย
                  </span>
                </div>
              </Card>
              <Card className="p-4 bg-blue-50">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    {Object.keys(groupedSessions).length} วัน
                  </span>
                </div>
              </Card>
            </div>

            {/* Sessions List */}
            <div className="space-y-6 max-h-96 overflow-y-auto">
              {Object.entries(groupedSessions).map(([date, dateSessions]) => (
                <div key={date}>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 sticky top-0 bg-white py-1">
                    {format(new Date(date), 'dd MMMM yyyy', { locale: th })}
                  </h3>
                  
                  <div className="space-y-3">
                    {dateSessions.map((session) => (
                      <Card 
                        key={session.id}
                        className="p-4 hover:shadow-md transition-all cursor-pointer border-l-4 border-l-blue-500"
                        onClick={() => handleSessionClick(session)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <User className="w-4 h-4 text-gray-500" />
                              <span className="font-medium text-gray-900">
                                {session.clientName}
                              </span>
                              <ChevronRight className="w-3 h-3 text-gray-400" />
                              <Target className="w-4 h-4 text-gray-500" />
                              <span className="text-gray-700">
                                {session.productFocus}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(new Date(session.createdAt), 'HH:mm')}
                              </div>
                              <div className="flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                {session.ideasCount} ไอเดีย
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {session.modelUsed}
                              </Badge>
                            </div>
                            
                            {session.userInput && (
                              <p className="text-sm text-gray-600 line-clamp-2">
                                {session.userInput}
                              </p>
                            )}
                            
                            {session.selectedTemplate && (
                              <Badge variant="secondary" className="text-xs mt-2">
                                Template: {session.selectedTemplate}
                              </Badge>
                            )}
                          </div>
                          
                          <ChevronRight className="w-5 h-5 text-gray-400 ml-4" />
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="mt-6 text-center">
                <Button 
                  variant="outline" 
                  onClick={() => loadHistory(false)}
                  disabled={loading}
                >
                  {loading ? 'กำลังโหลด...' : 'โหลดเพิ่มเติม'}
                </Button>
              </div>
            )}

            {sessions.length === 0 && !loading && (
              <div className="text-center py-8">
                <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">ยังไม่มีประวัติการสร้างไอเดีย</p>
                <p className="text-gray-400 text-sm">เริ่มสร้างไอเดียแรกของคุณกันเถอะ!</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Session Detail Modal */}
      {selectedSession && (
        <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                ไอเดียจาก {format(new Date(selectedSession.createdAt), 'dd MMM yyyy HH:mm', { locale: th })}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-700">ลูกค้า:</span>
                  <p className="text-gray-900">{selectedSession.clientName}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700">Product Focus:</span>
                  <p className="text-gray-900">{selectedSession.productFocus}</p>
                </div>
              </div>
              
              {selectedSession.userInput && (
                <div>
                  <span className="text-sm font-medium text-gray-700">คำสั่งเพิ่มเติม:</span>
                  <p className="text-gray-900 mt-1">{selectedSession.userInput}</p>
                </div>
              )}
              
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900">
                  ไอเดียที่สร้าง ({selectedSession.ideasCount} ข้อ)
                </h4>
                
                <div className="grid gap-3">
                  {selectedSession.ideas.map((idea, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900 mb-2">
                            {idea.title}
                          </h5>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {idea.category}
                            </Badge>
                            <Badge 
                              variant={idea.impact === 'High' ? 'default' : 'secondary'} 
                              className="text-xs"
                            >
                              {idea.impact} Impact
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}