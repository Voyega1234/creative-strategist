"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  formatSelectedServicesLabel,
  formatSelectedServicesText,
  toggleSelectedService,
} from "@/lib/clients/client-services"

export function useClientServices({
  activeClientId,
  activeProductFocusEntryId,
  isGenerating,
}: {
  activeClientId: string | null
  activeProductFocusEntryId?: string | null
  isGenerating: boolean
}) {
  const [clientServices, setClientServices] = useState<string[]>([])
  const [isLoadingServices, setIsLoadingServices] = useState(false)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [newServiceName, setNewServiceName] = useState("")
  const [isAddingService, setIsAddingService] = useState(false)
  const [serviceError, setServiceError] = useState<string | null>(null)

  const selectedServicesLabel = useMemo(
    () => formatSelectedServicesLabel(selectedServices),
    [selectedServices]
  )
  const selectedServicesText = useMemo(
    () => formatSelectedServicesText(selectedServices),
    [selectedServices]
  )

  useEffect(() => {
    if (!activeClientId) {
      setClientServices([])
      setSelectedServices([])
      return
    }

    let isCancelled = false
    const controller = new AbortController()

    const fetchServices = async () => {
      try {
        setIsLoadingServices(true)
        const response = await fetch(
          `/api/client-services?clientId=${encodeURIComponent(activeClientId)}`,
          {
            signal: controller.signal,
          }
        )

        if (!response.ok) {
          throw new Error(`Failed to fetch services: ${response.status}`)
        }

        const data = await response.json()
        if (isCancelled) return

        const services = Array.isArray(data.services)
          ? data.services.slice().sort((a: string, b: string) => a.localeCompare(b, "th"))
          : []
        setClientServices(services)
        setSelectedServices((prev) => prev.filter((service) => services.includes(service)))
      } catch (error) {
        if (isCancelled) return
        console.error("Error loading services:", error)
        setClientServices([])
        setSelectedServices([])
      } finally {
        if (!isCancelled) {
          setIsLoadingServices(false)
        }
      }
    }

    fetchServices()

    return () => {
      isCancelled = true
      controller.abort()
    }
  }, [activeClientId, activeProductFocusEntryId])

  const handleServiceToggle = useCallback(
    (service: string | null) => {
      if (isGenerating) {
        return
      }
      setSelectedServices((prev) => toggleSelectedService(prev, service))
    },
    [isGenerating]
  )

  const handleAddService = useCallback(async () => {
    if (!activeClientId) {
      setServiceError("กรุณาเลือกลูกค้าก่อน")
      return
    }

    const value = newServiceName.trim()
    if (!value) {
      setServiceError("กรุณากรอกชื่อบริการ")
      return
    }

    if (clientServices.some((service) => service.toLowerCase() === value.toLowerCase())) {
      setServiceError("มีบริการนี้อยู่แล้ว")
      setSelectedServices((prev) => {
        if (prev.includes(value)) {
          return prev
        }
        return [...prev, value]
      })
      setNewServiceName("")
      return
    }

    try {
      setServiceError(null)
      setIsAddingService(true)
      const response = await fetch("/api/client-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: activeClientId, service: value }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to add service")
      }

      setClientServices((prev) => {
        const next = [...prev, value]
        next.sort((a, b) => a.localeCompare(b, "th"))
        return next
      })
      setSelectedServices((prev) => (prev.includes(value) ? prev : [...prev, value]))
      setNewServiceName("")
    } catch (error) {
      console.error("Failed to add service:", error)
      setServiceError("ไม่สามารถเพิ่มบริการได้ กรุณาลองใหม่")
    } finally {
      setIsAddingService(false)
    }
  }, [activeClientId, clientServices, newServiceName])

  return {
    clientServices,
    isLoadingServices,
    selectedServices,
    selectedServicesLabel,
    selectedServicesText,
    newServiceName,
    setNewServiceName,
    isAddingService,
    serviceError,
    setServiceError,
    handleServiceToggle,
    handleAddService,
  }
}
