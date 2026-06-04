"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  History, 
  Clock, 
  User, 
  Target, 
  Sparkles, 
  ChevronRight,
  Calendar,
  TrendingUp,
  Pencil,
  Star
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
  isFavorite: boolean
  title?: string | null
  ideas: {
    title: string
    category: string
    concept_type: string
  }[]
}

interface SessionHistoryProps {
  isOpen: boolean
  onClose: () => void
  activeClientName?: string
}

export function SessionHistory({ isOpen, onClose, activeClientName }: SessionHistoryProps) {
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([])
  const [activeTab, setActiveTab] = useState<"recent" | "favorites">("recent")
  const [loading, setLoading] = useState(false)
  const [updatingFavoriteId, setUpdatingFavoriteId] = useState("")
  const [renamingSessionId, setRenamingSessionId] = useState("")
  const [titleDraft, setTitleDraft] = useState("")
  const [selectedSession, setSelectedSession] = useState<SessionHistoryItem | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const ITEMS_PER_PAGE = 50

  // Fast loading with caching
  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const result = await sessionManager.getHistory({
        clientName: activeClientName,
        limit: activeTab === "favorites" ? 50 : ITEMS_PER_PAGE,
        offset: 0,
        favoritesOnly: activeTab === "favorites"
      })

      if (result.success) {
        setSessions(result.sessions || [])
      }
    } catch (error) {
      console.error('Failed to load history:', error)
    } finally {
      setLoading(false)
    }
  }, [activeClientName, activeTab])

  // Load initial data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadHistory()
    }
  }, [isOpen, activeClientName, activeTab])

  const toggleFavorite = async (event: React.MouseEvent, session: SessionHistoryItem) => {
    event.stopPropagation()
    setUpdatingFavoriteId(session.id)
    const success = await sessionManager.setFavorite(session.id, !session.isFavorite)
    if (success) {
      setSessions((current) =>
        activeTab === "favorites"
          ? current.filter((item) => item.id !== session.id)
          : current.map((item) => (item.id === session.id ? { ...item, isFavorite: !item.isFavorite } : item)),
      )
      if (selectedSession?.id === session.id) {
        setSelectedSession({ ...selectedSession, isFavorite: !session.isFavorite })
      }
    }
    setUpdatingFavoriteId("")
  }

  const startRename = (event: React.MouseEvent, session: SessionHistoryItem) => {
    event.stopPropagation()
    setRenamingSessionId(session.id)
    setTitleDraft(session.title || session.userInput || "Custom Ideas")
  }

  const cancelRename = () => {
    setRenamingSessionId("")
    setTitleDraft("")
  }

  const saveRename = async (session: SessionHistoryItem) => {
    const normalizedTitle = titleDraft.trim()
    if (!normalizedTitle) return
    const success = await sessionManager.renameSession(session.id, normalizedTitle)
    if (success) {
      setSessions((current) =>
        current.map((item) => (item.id === session.id ? { ...item, title: normalizedTitle } : item)),
      )
      if (selectedSession?.id === session.id) {
        setSelectedSession({ ...selectedSession, title: normalizedTitle })
      }
      setRenamingSessionId("")
      setTitleDraft("")
    }
  }

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
              Ideas History
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-6 pt-2">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "recent" | "favorites")} className="mb-5">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="recent">ประวัติทั้งหมด</TabsTrigger>
                <TabsTrigger value="favorites">รายการโปรด</TabsTrigger>
              </TabsList>
            </Tabs>

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
                            {renamingSessionId === session.id ? (
                              <div
                                className="mb-3 flex gap-2"
                                onClick={(event) => event.stopPropagation()}
                                onBlur={(event) => {
                                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                                    cancelRename()
                                  }
                                }}
                              >
                                <Input
                                  value={titleDraft}
                                  onChange={(event) => setTitleDraft(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") void saveRename(session)
                                    if (event.key === "Escape") cancelRename()
                                  }}
                                  maxLength={100}
                                  autoFocus
                                />
                                <Button type="button" size="sm" onClick={() => void saveRename(session)}>
                                  บันทึก
                                </Button>
                              </div>
                            ) : (
                              <div className="mb-2 flex items-center gap-2">
                                <p className="font-semibold text-gray-950">{session.title || session.userInput || "Custom Ideas"}</p>
                                <button
                                  type="button"
                                  onClick={(event) => startRename(event, session)}
                                  className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                                  aria-label="Rename session"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
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
                          <button
                            type="button"
                            onClick={(event) => void toggleFavorite(event, session)}
                            disabled={updatingFavoriteId === session.id}
                            className="ml-2 rounded-full p-2 text-gray-400 transition hover:bg-amber-50 hover:text-amber-500 disabled:opacity-50"
                            aria-label={session.isFavorite ? "Remove from favorites" : "Add to favorites"}
                          >
                            {updatingFavoriteId === session.id ? (
                              <Clock className="h-5 w-5 animate-spin" />
                            ) : (
                              <Star className={`h-5 w-5 ${session.isFavorite ? "fill-amber-400 text-amber-500" : ""}`} />
                            )}
                          </button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {sessions.length === 0 && !loading && (
              <div className="text-center py-8">
                <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">{activeTab === "favorites" ? "ยังไม่มีรายการโปรด" : "ยังไม่มีประวัติการสร้างไอเดีย"}</p>
                <p className="text-gray-400 text-sm">
                  {activeTab === "favorites" ? "กดรูปดาวที่ session เพื่อเก็บไว้ในรายการโปรด" : "เริ่มสร้างไอเดียแรกของคุณกันเถอะ!"}
                </p>
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
              <DialogTitle className="flex items-center justify-between gap-2 pr-8">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  {selectedSession.title || `ไอเดียจาก ${format(new Date(selectedSession.createdAt), 'dd MMM yyyy HH:mm', { locale: th })}`}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={(event) => void toggleFavorite(event, selectedSession)}
                  disabled={updatingFavoriteId === selectedSession.id}
                >
                  <Star className={`mr-2 h-4 w-4 ${selectedSession.isFavorite ? "fill-amber-400 text-amber-500" : ""}`} />
                  {selectedSession.isFavorite ? "Favorited" : "Favorite"}
                </Button>
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
                              variant="default" 
                              className={`text-xs ${
                                idea.concept_type === 'Proven Concept' ? 'bg-blue-500 text-white' :
                                idea.concept_type === 'New Concept' ? 'bg-purple-500 text-white' :
                                'bg-gray-500 text-white'
                              }`}
                            >
                              {idea.concept_type}
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
