"use client"

import { Check, ChevronsUpDown, Loader2, Target } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface ClientProductOption {
  id: string
  clientName: string
  productFocuses: Array<{
    productFocus: string
  }>
}

interface ClientProductCardProps {
  clients: ClientProductOption[]
  currentClient: ClientProductOption | null
  selectedClientId: string
  selectedProductFocus: string
  loadingClients: boolean
  isClientPopoverOpen: boolean
  onClientPopoverOpenChange: (open: boolean) => void
  onClientChange: (clientId: string) => void
  onProductFocusChange: (productFocus: string) => void
  onClearClient: () => void
  onClearProductFocus: () => void
}

export function ClientProductCard({
  clients,
  currentClient,
  selectedClientId,
  selectedProductFocus,
  loadingClients,
  isClientPopoverOpen,
  onClientPopoverOpenChange,
  onClientChange,
  onProductFocusChange,
  onClearClient,
  onClearProductFocus,
}: ClientProductCardProps) {
  const selectedClientProductFocuses =
    clients.find((client) => client.id === selectedClientId)?.productFocuses || []

  return (
    <Card className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.04)]">
      <div className="px-7 pt-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Step 1</p>
            <h4 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-slate-950">
              Choose client and product focus
            </h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              เลือก context ที่จะใช้ generate ก่อน แล้วค่อยไปเขียน brief ใน step ถัดไป
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
            <div>
              <span className="text-slate-400">Client</span>
              <span className="ml-2 text-slate-700">{currentClient?.clientName || "Not selected"}</span>
            </div>
            <div>
              <span className="text-slate-400">Focus</span>
              <span className="ml-2 text-slate-700">{selectedProductFocus || "Not selected"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-7">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <Target className="h-4 w-4 text-blue-600" />
              Client
            </label>
            {loadingClients ? (
              <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                <span className="ml-2 text-sm text-slate-500">กำลังโหลด...</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <Popover open={isClientPopoverOpen} onOpenChange={onClientPopoverOpenChange}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isClientPopoverOpen}
                      className="h-12 flex-1 justify-between rounded-2xl border-slate-200 bg-white px-4 font-normal text-slate-900 hover:bg-white"
                    >
                      <span className="truncate">{currentClient?.clientName || "เลือกลูกค้า"}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-500" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-[var(--radix-popover-trigger-width)] min-w-[280px] rounded-2xl border-slate-200 p-0"
                  >
                    <Command>
                      <CommandInput placeholder="พิมพ์ค้นหาชื่อลูกค้า..." />
                      <CommandList>
                        <CommandEmpty>ไม่พบชื่อลูกค้า</CommandEmpty>
                        <CommandGroup>
                          {clients.map((client) => (
                            <CommandItem
                              key={client.id}
                              value={client.clientName}
                              onSelect={() => onClientChange(client.id)}
                              className="flex items-center justify-between px-3 py-2"
                            >
                              <span>{client.clientName}</span>
                              <Check
                                className={cn(
                                  "h-4 w-4 text-slate-900",
                                  selectedClientId === client.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedClientId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClearClient}
                    className="h-12 rounded-2xl border-slate-200 px-4 text-slate-700"
                  >
                    Clear
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-900">Product Focus</label>
            {selectedClientId ? (
              <div className="flex gap-2">
                <Select value={selectedProductFocus} onValueChange={onProductFocusChange}>
                  <SelectTrigger className="h-12 flex-1 rounded-2xl border-slate-200 bg-white focus:border-slate-950 focus:ring-0">
                    <SelectValue placeholder="เลือก Product Focus" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedClientProductFocuses.map((pf) => (
                      <SelectItem key={pf.productFocus} value={pf.productFocus}>
                        {pf.productFocus}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProductFocus && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClearProductFocus}
                    className="h-12 rounded-2xl border-slate-200 px-4 text-slate-700"
                  >
                    Clear
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                เลือกลูกค้าก่อน
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
