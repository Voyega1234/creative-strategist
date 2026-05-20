"use client"

import * as React from "react"
import { ImagePlus, Loader2, Send, X } from "lucide-react"

import { cn } from "@/lib/utils"

type PromptBoxSubmit = {
  message: string
  imageFile: File | null
}

type PromptBoxProps = Omit<React.FormHTMLAttributes<HTMLFormElement>, "onSubmit"> & {
  placeholder?: string
  disabled?: boolean
  isLoading?: boolean
  onAttachClick?: () => void
  onSubmit: (payload: PromptBoxSubmit) => void
}

export function PromptBox({
  className,
  placeholder = "Describe the edit you want...",
  disabled = false,
  isLoading = false,
  onAttachClick,
  onSubmit,
  ...props
}: PromptBoxProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [message, setMessage] = React.useState("")
  const [imageFile, setImageFile] = React.useState<File | null>(null)
  const [imagePreview, setImagePreview] = React.useState("")

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`
  }, [message])

  React.useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  const canSubmit = Boolean(message.trim() || imageFile) && !disabled && !isLoading

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    event.target.value = ""
    if (!file || !file.type.startsWith("image/")) return

    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview("")
  }

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    onSubmit({ message: message.trim(), imageFile })
    setMessage("")
    removeImage()
  }

  return (
    <form
      className={cn("rounded-[28px] border border-slate-200 bg-white p-2 shadow-sm", className)}
      onSubmit={submit}
      {...props}
    >
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {imagePreview ? (
        <div className="relative mb-2 ml-1 w-fit overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-1">
          <img src={imagePreview} alt="Attached image" className="h-16 w-16 rounded-xl object-cover" />
          <button
            type="button"
            onClick={removeImage}
            className="absolute right-1 top-1 rounded-full bg-slate-950/85 p-1 text-white transition hover:bg-slate-800"
            aria-label="Remove attached image"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}

      <textarea
        ref={textareaRef}
        rows={1}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            event.currentTarget.form?.requestSubmit()
          }
        }}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        className="min-h-12 w-full resize-none border-0 bg-transparent p-3 text-base text-slate-950 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
      />

      <div className="flex items-center gap-2 px-1 pb-1">
        <button
          type="button"
          onClick={() => {
            if (onAttachClick) {
              onAttachClick()
              return
            }
            fileInputRef.current?.click()
          }}
          disabled={disabled || isLoading}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Attach image"
        >
          <ImagePlus className="h-5 w-5" />
        </button>
        <p className="text-xs text-slate-400">Shift + Enter for new line</p>
        <button
          type="submit"
          disabled={!canSubmit}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          aria-label="Send edit request"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </form>
  )
}
