"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { getStorageClient } from "@/lib/supabase/client"
import type { ReferenceImage } from "@/lib/images/generated-ads"

const MAX_REFERENCE_SELECTION = 5

interface UseGeneratedAdAssetsParams {
  selectedClientId: string
  selectedProductFocus: string
  clientColorPalette?: string[]
  onClientColorPaletteSaved: (clientId: string, colorPalette: string[]) => void
}

export function useGeneratedAdAssets({
  selectedClientId,
  selectedProductFocus,
  clientColorPalette,
  onClientColorPaletteSaved,
}: UseGeneratedAdAssetsParams) {
  const materialInputRef = useRef<HTMLInputElement | null>(null)
  const referenceInputRef = useRef<HTMLInputElement | null>(null)
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([])
  const [selectedReferenceImages, setSelectedReferenceImages] = useState<string[]>([])
  const [loadingReferenceImages, setLoadingReferenceImages] = useState(false)
  const [isUploadingReferences, setIsUploadingReferences] = useState(false)
  const [isReferenceDropActive, setIsReferenceDropActive] = useState(false)
  const [materialImages, setMaterialImages] = useState<ReferenceImage[]>([])
  const [loadingMaterialImages, setLoadingMaterialImages] = useState(false)
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
  const [isUploadingMaterials, setIsUploadingMaterials] = useState(false)
  const [colorPalette, setColorPalette] = useState<string[]>([])
  const [colorInput, setColorInput] = useState("")
  const [isSavingPalette, setIsSavingPalette] = useState(false)

  useEffect(() => {
    setColorPalette(clientColorPalette || [])
  }, [clientColorPalette, selectedClientId])

  const loadMaterialImages = useCallback(async (clientId: string) => {
    try {
      console.log("[AI Image Generator] Loading material images for", clientId)
      setLoadingMaterialImages(true)
      const storageClient = getStorageClient()

      if (!storageClient) {
        console.error("Storage client not available")
        setMaterialImages([])
        return
      }

      const folderPath = `materials/${clientId}`
      const { data: files, error } = await storageClient.from("ads-creative-image").list(folderPath, {
        limit: 100,
        offset: 0,
        sortBy: { column: "name", order: "desc" },
      })

      if (error) {
        if (error.message?.toLowerCase().includes("not found")) {
          setMaterialImages([])
          setSelectedMaterials([])
          return
        }
        console.error("Error loading material images:", error)
        return
      }

      if (!files || files.length === 0) {
        setMaterialImages([])
        setSelectedMaterials([])
        return
      }

      const imagePromises = files.map(async (file) => {
        const { data: urlData } = storageClient
          .from("ads-creative-image")
          .getPublicUrl(`${folderPath}/${file.name}`)

        return {
          name: file.name,
          url: urlData.publicUrl,
          size: file.metadata?.size || 0,
          created_at: file.created_at || new Date().toISOString(),
        }
      })

      const imageList = await Promise.all(imagePromises)
      const sortedImages = imageList.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )

      setMaterialImages(sortedImages)
      setSelectedMaterials((prev) => prev.filter((url) => sortedImages.some((image) => image.url === url)))
    } catch (error) {
      console.error("Error loading material images:", error)
    } finally {
      setLoadingMaterialImages(false)
    }
  }, [])

  const loadReferenceImages = useCallback(async () => {
    try {
      console.log("🔄 Starting to load reference images...")
      setLoadingReferenceImages(true)
      const storageClient = getStorageClient()

      if (!storageClient) {
        console.error("❌ Storage client not available")
        return
      }

      console.log("🔍 Fetching files from Supabase storage...")
      const { data: files, error } = await storageClient.from("ads-creative-image").list("references/", {
        limit: 100,
        offset: 0,
        sortBy: { column: "name", order: "desc" },
      })

      console.log("📊 Supabase storage response:", {
        filesCount: files?.length || 0,
        error: error?.message || "No error",
        files:
          files?.map((file) => ({
            name: file.name,
            size: file.metadata?.size,
            created_at: file.created_at,
          })) || [],
      })

      if (error) {
        console.error("Error loading reference images:", error)
        return
      }

      if (!files || files.length === 0) {
        console.log("No reference images found")
        setReferenceImages([])
        return
      }

      const imagePromises = files.map(async (file) => {
        const { data: urlData } = storageClient.from("ads-creative-image").getPublicUrl(`references/${file.name}`)

        return {
          name: file.name,
          url: urlData.publicUrl,
          size: file.metadata?.size || 0,
          created_at: file.created_at || new Date().toISOString(),
        }
      })

      const imageList = await Promise.all(imagePromises)
      const sortedImages = imageList.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )

      setReferenceImages(sortedImages)
      console.log("[AI Image Generator] Loaded", sortedImages.length, "reference images")
    } catch (error) {
      console.error("Error loading reference images:", error)
    } finally {
      setLoadingReferenceImages(false)
    }
  }, [])

  useEffect(() => {
    if (selectedClientId && selectedProductFocus) {
      setSelectedReferenceImages([])
      void loadReferenceImages()
      void loadMaterialImages(selectedClientId)
    } else {
      setMaterialImages([])
      setSelectedMaterials([])
      setSelectedReferenceImages([])
    }
  }, [loadMaterialImages, loadReferenceImages, selectedClientId, selectedProductFocus])

  const toggleMaterial = (url: string) => {
    setSelectedMaterials((prev) => {
      if (prev.includes(url)) {
        return prev.filter((item) => item !== url)
      }
      return [...prev, url]
    })
  }

  const uploadReferences = async (files: FileList | null) => {
    if (!files) return

    const storageClient = getStorageClient()
    if (!storageClient) {
      alert("ไม่สามารถเชื่อมต่อที่จัดเก็บไฟล์ได้")
      return
    }

    setIsUploadingReferences(true)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue
        const fileExt = file.name.split(".").pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`
        const fullPath = `references/${fileName}`
        const { error } = await storageClient.from("ads-creative-image").upload(fullPath, file)
        if (error) {
          console.error("Reference upload error:", error)
          throw error
        }
      }

      await loadReferenceImages()
    } catch (error) {
      console.error("Failed to upload references:", error)
      alert("เกิดข้อผิดพลาดในการอัปโหลดรูป reference")
    } finally {
      setIsUploadingReferences(false)
      setIsReferenceDropActive(false)
      if (referenceInputRef.current) {
        referenceInputRef.current.value = ""
      }
    }
  }

  const uploadMaterials = async (files: FileList | null) => {
    if (!files || !selectedClientId) {
      alert("กรุณาเลือกลูกค้าก่อนอัปโหลดวัสดุ")
      return
    }

    const storageClient = getStorageClient()
    if (!storageClient) {
      alert("ไม่สามารถเชื่อมต่อที่จัดเก็บไฟล์ได้")
      return
    }

    setIsUploadingMaterials(true)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue
        const fileExt = file.name.split(".").pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`
        const fullPath = `materials/${selectedClientId}/${fileName}`
        const { error } = await storageClient.from("ads-creative-image").upload(fullPath, file)
        if (error) {
          console.error("Material upload error:", error)
          throw error
        }
      }

      await loadMaterialImages(selectedClientId)
      alert("อัปโหลดวัสดุเรียบร้อยแล้ว")
    } catch (error) {
      console.error("Failed to upload materials:", error)
      alert("เกิดข้อผิดพลาดในการอัปโหลดวัสดุ")
    } finally {
      setIsUploadingMaterials(false)
      if (materialInputRef.current) {
        materialInputRef.current.value = ""
      }
    }
  }

  const sanitizeColorValue = (value: string) => {
    return value.replace(/[^0-9a-fA-F]/g, "").substring(0, 6).toUpperCase()
  }

  const addColor = () => {
    const sanitized = sanitizeColorValue(colorInput)
    if (!sanitized) {
      alert("กรุณากรอกโค้ดสีที่ถูกต้อง")
      return
    }
    if (colorPalette.includes(sanitized)) {
      setColorInput("")
      return
    }
    setColorPalette((prev) => [...prev, sanitized])
    setColorInput("")
  }

  const removeColor = (index: number) => {
    setColorPalette((prev) => prev.filter((_, i) => i !== index))
  }

  const savePalette = async () => {
    if (!selectedClientId) {
      alert("กรุณาเลือกลูกค้าก่อน")
      return
    }
    setIsSavingPalette(true)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ""
      const response = await fetch(`${baseUrl}/api/update-client-color`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId: selectedClientId,
          colorPalette,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        alert(result?.error || "ไม่สามารถบันทึกพาเลตสีได้")
        return
      }

      onClientColorPaletteSaved(selectedClientId, colorPalette)
      alert("บันทึกพาเลตสีเรียบร้อยแล้ว")
    } catch (error) {
      console.error("Failed to save color palette:", error)
      alert("เกิดข้อผิดพลาดในการบันทึกพาเลตสี")
    } finally {
      setIsSavingPalette(false)
    }
  }

  const toggleReference = (imageUrl: string) => {
    const isSelected = selectedReferenceImages.includes(imageUrl)
    const isLimitReached = !isSelected && selectedReferenceImages.length >= MAX_REFERENCE_SELECTION

    if (isSelected) {
      setSelectedReferenceImages((prev) => prev.filter((url) => url !== imageUrl))
    } else if (!isLimitReached) {
      setSelectedReferenceImages((prev) => [...prev, imageUrl].slice(0, MAX_REFERENCE_SELECTION))
    } else {
      alert(`เลือกได้สูงสุด ${MAX_REFERENCE_SELECTION} รูป`)
    }
  }

  return {
    materialInputRef,
    referenceInputRef,
    referenceImages,
    selectedReferenceImages,
    loadingReferenceImages,
    isUploadingReferences,
    isReferenceDropActive,
    materialImages,
    loadingMaterialImages,
    selectedMaterials,
    isUploadingMaterials,
    colorPalette,
    colorInput,
    isSavingPalette,
    maxReferenceSelection: MAX_REFERENCE_SELECTION,
    setColorInput,
    setIsReferenceDropActive,
    toggleMaterial,
    toggleReference,
    uploadReferences,
    uploadMaterials,
    addColor,
    removeColor,
    savePalette,
  }
}
