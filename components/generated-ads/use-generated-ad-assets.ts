"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { getStorageClient } from "@/lib/supabase/client"
import type { ReferenceImage } from "@/lib/images/generated-ads"
import { loadClientReferenceImages, uploadClientReferenceFiles } from "@/lib/images/reference-library"

const MAX_REFERENCE_SELECTION = 5

interface UseGeneratedAdAssetsParams {
  selectedClientId: string
  selectedProductFocus: string
  clientColorPalette?: string[]
  onClientColorPaletteSaved: (clientId: string, colorPalette: string[]) => void
  loadAssets?: boolean
  loadReferences?: boolean
}

export function useGeneratedAdAssets({
  selectedClientId,
  selectedProductFocus,
  clientColorPalette,
  onClientColorPaletteSaved,
  loadAssets = true,
  loadReferences = true,
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

  useEffect(() => {
    setSelectedMaterials([])
    setSelectedReferenceImages([])
  }, [selectedClientId, selectedProductFocus])

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
      setLoadingReferenceImages(true)
      const { images } = await loadClientReferenceImages(selectedClientId)
      setReferenceImages(
        images.map((image) => ({
          name: image.name,
          url: image.url,
          size: image.size,
          created_at: image.createdAt,
        })),
      )
    } catch (error) {
      console.error("Error loading reference images:", error)
      setReferenceImages([])
    } finally {
      setLoadingReferenceImages(false)
    }
  }, [selectedClientId])

  useEffect(() => {
    if (selectedClientId && selectedProductFocus) {
      if (loadReferences) {
        void loadReferenceImages()
      }
      if (loadAssets) {
        void loadMaterialImages(selectedClientId)
      }
    } else {
      setMaterialImages([])
      setSelectedMaterials([])
      setSelectedReferenceImages([])
    }
  }, [loadAssets, loadMaterialImages, loadReferenceImages, loadReferences, selectedClientId, selectedProductFocus])

  const toggleMaterial = (url: string) => {
    setSelectedMaterials((prev) => {
      if (prev.includes(url)) {
        return prev.filter((item) => item !== url)
      }
      return [...prev, url]
    })
  }

  const selectMaterial = useCallback((url: string) => {
    if (!url) return
    setSelectedMaterials((prev) => (prev.includes(url) ? prev : [...prev, url]))
  }, [])

  const selectReference = useCallback((url: string) => {
    if (!url) return
    setSelectedReferenceImages((prev) =>
      prev.includes(url) ? prev : [...prev, url].slice(0, MAX_REFERENCE_SELECTION),
    )
  }, [])

  const uploadReferences = async (files: FileList | null) => {
    if (!files?.length) return []
    if (!selectedClientId || selectedClientId === "general") {
      alert("กรุณาเลือกลูกค้าก่อนอัปโหลด Reference")
      return []
    }

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"))
    if (!imageFiles.length) {
      return
    }

    setIsUploadingReferences(true)
    try {
      const uploaded = await uploadClientReferenceFiles(selectedClientId, imageFiles)
      const uploadedUrls = uploaded.map((image) => image.url)
      setSelectedReferenceImages((current) =>
        [...current, ...uploadedUrls.filter((url) => !current.includes(url))].slice(0, MAX_REFERENCE_SELECTION),
      )
      await loadReferenceImages()
      return uploadedUrls
    } catch (error) {
      console.error("Failed to upload references:", error)
      alert("เกิดข้อผิดพลาดในการอัปโหลดรูป reference")
      return []
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
      return []
    }

    const storageClient = getStorageClient()
    if (!storageClient) {
      alert("ไม่สามารถเชื่อมต่อที่จัดเก็บไฟล์ได้")
      return []
    }

    setIsUploadingMaterials(true)
    try {
      const uploadedUrls: string[] = []
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
        const { data } = storageClient.from("ads-creative-image").getPublicUrl(fullPath)
        if (data.publicUrl) {
          uploadedUrls.push(data.publicUrl)
        }
      }

      await loadMaterialImages(selectedClientId)
      if (uploadedUrls.length > 0) {
        setSelectedMaterials((current) => [
          ...current,
          ...uploadedUrls.filter((url) => !current.includes(url)),
        ])
        alert("อัปโหลดวัสดุเรียบร้อยแล้ว")
      }
      return uploadedUrls
    } catch (error) {
      console.error("Failed to upload materials:", error)
      alert("เกิดข้อผิดพลาดในการอัปโหลดวัสดุ")
      return []
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
    if (!/^[0-9A-F]{6}$/.test(sanitized)) {
      alert("กรุณากรอกโค้ดสี HEX 6 หลัก เช่น #265484")
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
    setColorPalette,
    setIsReferenceDropActive,
    toggleMaterial,
    selectMaterial,
    selectReference,
    toggleReference,
    loadMaterialImages,
    uploadReferences,
    uploadMaterials,
    addColor,
    removeColor,
    savePalette,
  }
}
