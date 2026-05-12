"use client"

import { useEffect, useMemo, useState, type ComponentProps } from "react"

import { EditableSavedIdeaModal } from "@/components/editable-saved-idea-modal"
import { getSupabase } from "@/lib/supabase/client"
import {
  buildCustomIdeaFallback,
  getTopicPreviewText,
  type ParsedCustomIdea,
} from "@/lib/custom-idea-parser"
import { getTopicSelectionKey, type SavedTopic } from "@/lib/images/generated-ads"
import type { VisualRoute } from "@/app/page"

const VISUAL_ROUTES_BY_IDEA_STORAGE_KEY = "cvc_visual_routes_by_idea"

type EditableIdeaType = NonNullable<ComponentProps<typeof EditableSavedIdeaModal>["idea"]>

interface UseGeneratedAdIdeasParams {
  selectedClientId: string
  selectedProductFocus: string
  currentClientName?: string | null
  activeClientName?: string | null
}

export function useGeneratedAdIdeas({
  selectedClientId,
  selectedProductFocus,
  currentClientName,
  activeClientName,
}: UseGeneratedAdIdeasParams) {
  const [savedTopics, setSavedTopics] = useState<SavedTopic[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string>("")
  const [visualRoutesByIdea, setVisualRoutesByIdea] = useState<Record<string, VisualRoute[]>>({})
  const [selectedVisualRouteIndex, setSelectedVisualRouteIndex] = useState<number | null>(null)
  const [customIdeaInput, setCustomIdeaInput] = useState("")
  const [isCustomIdeaDialogOpen, setIsCustomIdeaDialogOpen] = useState(false)
  const [isParsingCustomIdea, setIsParsingCustomIdea] = useState(false)
  const [deletingTopicId, setDeletingTopicId] = useState<string | null>(null)
  const [topicEditModalOpen, setTopicEditModalOpen] = useState(false)
  const [topicBeingEdited, setTopicBeingEdited] = useState<SavedTopic | null>(null)
  const [loadingTopics, setLoadingTopics] = useState(false)
  const [showAllTopics, setShowAllTopics] = useState(false)
  const [isIdeasOpen, setIsIdeasOpen] = useState(false)

  const selectedTopicData = useMemo(
    () => savedTopics.find((topic) => topic.title === selectedTopic) || null,
    [savedTopics, selectedTopic],
  )

  const availableVisualRoutes = useMemo(() => {
    if (!selectedTopicData) return null
    const key = getTopicSelectionKey(selectedTopicData)
    const routes = selectedTopicData.visual_routes?.length ? selectedTopicData.visual_routes : visualRoutesByIdea[key] || []
    return routes.length ? routes : null
  }, [selectedTopicData, visualRoutesByIdea])

  const selectedVisualRoute = useMemo(() => {
    if (!availableVisualRoutes || selectedVisualRouteIndex === null) return null
    return availableVisualRoutes[selectedVisualRouteIndex] || null
  }, [availableVisualRoutes, selectedVisualRouteIndex])

  const selectedTopicSummary = selectedTopicData ? getTopicPreviewText(selectedTopicData.description) : ""
  const visibleTopics = showAllTopics ? savedTopics : savedTopics.slice(0, 4)

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(VISUAL_ROUTES_BY_IDEA_STORAGE_KEY)
      if (stored) {
        setVisualRoutesByIdea(JSON.parse(stored))
      }
    } catch (error) {
      console.error("[AI Image Generator] Failed to load visual routes:", error)
    }
  }, [])

  useEffect(() => {
    setSelectedVisualRouteIndex(null)
  }, [selectedTopic])

  useEffect(() => {
    if (selectedTopicData) {
      setIsIdeasOpen(true)
    }
  }, [selectedTopicData])

  useEffect(() => {
    if (!selectedClientId || !selectedProductFocus) {
      setSelectedTopic("")
    }
  }, [selectedClientId, selectedProductFocus])

  const loadSavedTopics = async () => {
    if (!selectedClientId || !selectedProductFocus || !currentClientName) return

    try {
      setLoadingTopics(true)

      console.log("[AI Image Generator] Direct Supabase query for:", {
        clientName: currentClientName,
        productFocus: selectedProductFocus,
        selectedClientId,
      })

      const supabase = getSupabase()
      const startTime = performance.now()

      const { data, error } = await supabase
        .from("savedideas")
        .select(`
          id,
          clientname,
          productfocus,
          title,
          description,
          category,
          concept_type,
          competitivegap,
          tags,
          content_pillar,
          product_focus,
          concept_idea,
          copywriting_headline,
          copywriting_sub_headline_1,
          copywriting_sub_headline_2,
          copywriting_bullets,
          copywriting_cta,
          savedat
        `)
        .eq("clientname", currentClientName)
        .eq("productfocus", selectedProductFocus)
        .order("savedat", { ascending: false })
        .limit(50)

      const endTime = performance.now()
      console.log(`[AI Image Generator] Direct Supabase query completed in ${endTime - startTime}ms for ${data?.length || 0} items`)

      if (error) {
        console.error("[AI Image Generator] Supabase error:", error)
        return
      }

      const nextSavedTopics = (data || []).map(transformSavedIdeaRecordToTopic)
      setSavedTopics(nextSavedTopics)
      console.log("[AI Image Generator] Loaded saved topics:", nextSavedTopics.length)
    } catch (error) {
      console.error("[AI Image Generator] Error loading saved topics:", error)
    } finally {
      setLoadingTopics(false)
    }
  }

  useEffect(() => {
    if (selectedClientId && selectedProductFocus) {
      void loadSavedTopics()
    }
  }, [selectedClientId, selectedProductFocus, currentClientName])

  const handleTopicSave = (updatedIdea: SavedTopic) => {
    setSavedTopics((prev) =>
      prev.map((topic) => {
        const matches = updatedIdea.id ? topic.id === updatedIdea.id : topic.title === topicBeingEdited?.title
        return matches ? { ...topic, ...updatedIdea } : topic
      }),
    )
    if (updatedIdea.title && selectedTopic === topicBeingEdited?.title) {
      setSelectedTopic(updatedIdea.title)
    }
  }

  const buildSavedTopicFromParsedIdea = (
    parsedIdea: ParsedCustomIdea,
    fallbackClientName: string | null,
    fallbackProductFocus: string | null,
  ): SavedTopic => ({
    id: `custom-${Date.now()}`,
    clientname: fallbackClientName || "",
    productfocus: fallbackProductFocus || "",
    title: parsedIdea.title,
    description: parsedIdea.description,
    category: parsedIdea.category,
    concept_type: parsedIdea.concept_type,
    competitiveGap: parsedIdea.competitiveGap,
    tags: parsedIdea.tags,
    content_pillar: parsedIdea.content_pillar,
    product_focus: parsedIdea.product_focus || fallbackProductFocus || "",
    concept_idea: parsedIdea.concept_idea,
    copywriting: parsedIdea.copywriting,
  })

  const transformSavedIdeaRecordToTopic = (record: any): SavedTopic => {
    let tags: string[] = []
    try {
      tags = Array.isArray(record?.tags) ? record.tags : JSON.parse(record?.tags || "[]")
    } catch {
      tags = typeof record?.tags === "string" ? record.tags.split(",").map((tag: string) => tag.trim()).filter(Boolean) : []
    }

    let bullets: string[] = []
    try {
      bullets = Array.isArray(record?.copywriting_bullets)
        ? record.copywriting_bullets
        : JSON.parse(record?.copywriting_bullets || "[]")
    } catch {
      bullets =
        typeof record?.copywriting_bullets === "string"
          ? record.copywriting_bullets.split(",").map((bullet: string) => bullet.trim()).filter(Boolean)
          : []
    }

    return {
      id: record?.id,
      clientname: record?.clientname || currentClientName || activeClientName || "",
      productfocus: record?.productfocus || selectedProductFocus,
      title: record?.title || "Untitled Idea",
      description: record?.description || "",
      category: record?.category || "Educate",
      concept_type: record?.concept_type || "",
      competitiveGap: record?.competitivegap || record?.competitiveGap || "",
      tags,
      content_pillar: record?.content_pillar || "",
      product_focus: record?.product_focus || selectedProductFocus || "",
      concept_idea: record?.concept_idea || record?.description || "",
      copywriting: {
        headline: record?.copywriting_headline || record?.copywriting?.headline || "",
        sub_headline_1: record?.copywriting_sub_headline_1 || record?.copywriting?.sub_headline_1 || "",
        sub_headline_2: record?.copywriting_sub_headline_2 || record?.copywriting?.sub_headline_2 || "",
        bullets,
        cta: record?.copywriting_cta || record?.copywriting?.cta || "",
      },
    }
  }

  const addCustomIdea = async () => {
    const normalizedInput = customIdeaInput.trim()

    if (!normalizedInput) {
      alert("กรุณาใส่ idea ก่อน")
      return
    }

    if (!selectedClientId || !selectedProductFocus) {
      alert("กรุณาเลือกลูกค้าและ Product Focus ก่อน")
      return
    }

    const fallbackClientName = currentClientName || activeClientName || null
    if (!fallbackClientName || fallbackClientName === "No Client Selected") {
      alert("ไม่พบชื่อลูกค้าที่ใช้บันทึกไอเดีย")
      return
    }

    let parsedIdea = buildCustomIdeaFallback(normalizedInput)

    try {
      setIsParsingCustomIdea(true)
      const response = await fetch("/api/parse-custom-idea", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputText: normalizedInput,
          clientName: fallbackClientName,
          productFocus: selectedProductFocus,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.idea) {
          parsedIdea = result.idea as ParsedCustomIdea
        }
      } else {
        console.error("[AI Image Generator] Failed to parse custom idea:", response.status)
      }
    } catch (error) {
      console.error("[AI Image Generator] Error parsing custom idea:", error)
    }

    const customTopic = buildSavedTopicFromParsedIdea(parsedIdea, fallbackClientName, selectedProductFocus)

    try {
      const saveResponse = await fetch("/api/save-idea", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idea: customTopic,
          clientName: fallbackClientName,
          productFocus: selectedProductFocus,
          action: "save",
        }),
      })

      const saveResult = await saveResponse.json()

      if (!saveResponse.ok || !saveResult.success) {
        alert(saveResult?.error || "ไม่สามารถบันทึกไอเดียได้")
        return
      }

      const persistedTopic = transformSavedIdeaRecordToTopic(saveResult.savedIdea || customTopic)

      setSavedTopics((prev) => {
        const withoutDuplicateTitle = prev.filter((topic) => topic.title !== persistedTopic.title)
        return [persistedTopic, ...withoutDuplicateTitle]
      })
      setSelectedTopic(persistedTopic.title)
      setShowAllTopics(false)
      setCustomIdeaInput("")
      setIsCustomIdeaDialogOpen(false)
    } catch (error) {
      console.error("[AI Image Generator] Error saving custom idea:", error)
      alert("เกิดข้อผิดพลาดในการบันทึกไอเดีย")
    } finally {
      setIsParsingCustomIdea(false)
    }
  }

  const deleteTopic = async (topic: SavedTopic) => {
    const topicKey = topic.id || topic.title
    const isCustomTopic = topic.id?.startsWith("custom-")
    const confirmed = window.confirm(`ลบไอเดีย "${topic.title}" ใช่หรือไม่?`)

    if (!confirmed) {
      return
    }

    try {
      setDeletingTopicId(topicKey)

      if (!isCustomTopic) {
        const supabase = getSupabase()
        const query = supabase.from("savedideas").delete()

        const { error } = topic.id
          ? await query.eq("id", topic.id)
          : await query
              .eq("clientname", topic.clientname || currentClientName || "")
              .eq("productfocus", topic.productfocus || selectedProductFocus)
              .eq("title", topic.title)

        if (error) {
          console.error("[AI Image Generator] Error deleting saved idea:", error)
          alert("เกิดข้อผิดพลาดในการลบไอเดีย")
          return
        }
      }

      const nextTopics = savedTopics.filter((item) => (item.id || item.title) !== topicKey)
      setSavedTopics(nextTopics)

      if (selectedTopic === topic.title) {
        setSelectedTopic(nextTopics[0]?.title || "")
      }
    } catch (error) {
      console.error("[AI Image Generator] Error deleting topic:", error)
      alert("เกิดข้อผิดพลาดในการลบไอเดีย")
    } finally {
      setDeletingTopicId(null)
    }
  }

  const convertTopicToEditableIdea = (
    topic: SavedTopic | null,
    fallbackClientName: string | null,
    fallbackProductFocus: string | null,
  ): EditableIdeaType | null => {
    if (!topic) return null

    const tags = Array.isArray(topic.tags) ? JSON.stringify(topic.tags) : topic.tags || "[]"
    const bullets =
      Array.isArray(topic.copywriting.bullets) || typeof topic.copywriting.bullets === "string"
        ? Array.isArray(topic.copywriting.bullets)
          ? JSON.stringify(topic.copywriting.bullets)
          : topic.copywriting.bullets
        : "[]"

    return {
      id: topic.id || "",
      clientname: topic.clientname || fallbackClientName || "",
      productfocus: topic.productfocus || fallbackProductFocus || "",
      title: topic.title,
      description: topic.description,
      category: topic.category,
      concept_type: topic.concept_type,
      impact: topic.concept_type,
      competitivegap: topic.competitiveGap,
      tags,
      content_pillar: topic.content_pillar,
      product_focus: topic.product_focus,
      concept_idea: topic.concept_idea,
      copywriting_headline: topic.copywriting.headline,
      copywriting_sub_headline_1: topic.copywriting.sub_headline_1,
      copywriting_sub_headline_2: topic.copywriting.sub_headline_2,
      copywriting_bullets: bullets,
      copywriting_cta: topic.copywriting.cta,
      savedat: new Date().toISOString(),
    }
  }

  const convertEditableIdeaToTopic = (idea: EditableIdeaType): SavedTopic => {
    const parseArray = (input: any) => {
      if (Array.isArray(input)) return input
      if (typeof input === "string") {
        try {
          return JSON.parse(input)
        } catch {
          return input.split(",").map((item) => item.trim()).filter(Boolean)
        }
      }
      return []
    }

    return {
      id: idea.id,
      clientname: idea.clientname,
      productfocus: idea.productfocus,
      title: idea.title,
      description: idea.description,
      category: idea.category,
      concept_type: idea.concept_type,
      competitiveGap: idea.competitivegap,
      tags: parseArray(idea.tags),
      content_pillar: idea.content_pillar,
      product_focus: idea.product_focus,
      concept_idea: idea.concept_idea,
      copywriting: {
        headline: idea.copywriting_headline,
        sub_headline_1: idea.copywriting_sub_headline_1,
        sub_headline_2: idea.copywriting_sub_headline_2,
        bullets: parseArray(idea.copywriting_bullets),
        cta: idea.copywriting_cta,
      },
    }
  }

  const openTopicEdit = (topic: SavedTopic) => {
    setTopicBeingEdited(topic)
    setTopicEditModalOpen(true)
  }

  const closeTopicEdit = () => {
    setTopicEditModalOpen(false)
    setTopicBeingEdited(null)
  }

  const saveEditableIdea = (updatedIdea: EditableIdeaType) => {
    handleTopicSave(convertEditableIdeaToTopic(updatedIdea))
    setTopicEditModalOpen(false)
  }

  return {
    savedTopics,
    selectedTopic,
    selectedTopicData,
    selectedTopicSummary,
    availableVisualRoutes,
    selectedVisualRoute,
    selectedVisualRouteIndex,
    customIdeaInput,
    isCustomIdeaDialogOpen,
    isParsingCustomIdea,
    deletingTopicId,
    topicEditModalOpen,
    editableIdea: convertTopicToEditableIdea(topicBeingEdited, currentClientName || activeClientName || null, selectedProductFocus),
    loadingTopics,
    showAllTopics,
    visibleTopics,
    isIdeasOpen,
    setSelectedTopic,
    setSelectedVisualRouteIndex,
    setCustomIdeaInput,
    setIsCustomIdeaDialogOpen,
    setShowAllTopics,
    setIsIdeasOpen,
    addCustomIdea,
    deleteTopic,
    openTopicEdit,
    closeTopicEdit,
    saveEditableIdea,
  }
}
