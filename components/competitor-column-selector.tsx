"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Settings } from "lucide-react"

// Define all available columns
interface ColumnConfig {
  key: keyof CompetitorColumnData
  label: string
  isDefault: boolean
  description?: string
}

interface CompetitorColumnData {
  name: string | null
  services: string | null
  pricing: string | null
  strengths: string | null
  weaknesses: string | null
  website: string | null
  facebookUrl: string | null
  serviceCategories: string | null
  features: string | null
  specialty: string | null
  targetAudience: string | null
  brandTone: string | null
  positivePerception: string | null
  negativePerception: string | null
  adThemes: string | null
  usp: string | null
}

const AVAILABLE_COLUMNS: ColumnConfig[] = [
  // Default columns (always visible)
  { key: 'name', label: 'Competitor', isDefault: true },
  { key: 'services', label: 'Services', isDefault: true },
  { key: 'pricing', label: 'Pricing', isDefault: true },
  { key: 'strengths', label: 'Strengths', isDefault: true },
  { key: 'weaknesses', label: 'Weaknesses', isDefault: true },
  
  // Optional columns (can be toggled)
  { key: 'website', label: 'Website', isDefault: false, description: 'Company website URL' },
  { key: 'facebookUrl', label: 'Facebook', isDefault: false, description: 'Facebook page URL' },
  { key: 'serviceCategories', label: 'Service Categories', isDefault: false, description: 'Business categories' },
  { key: 'features', label: 'Features', isDefault: false, description: 'Product/service features' },
  { key: 'specialty', label: 'Specialty', isDefault: false, description: 'Main specialty or focus' },
  { key: 'targetAudience', label: 'Target Audience', isDefault: false, description: 'Customer demographics' },
  { key: 'brandTone', label: 'Brand Tone', isDefault: false, description: 'Communication style' },
  { key: 'positivePerception', label: 'Positive Perception', isDefault: false, description: 'Positive reputation' },
  { key: 'negativePerception', label: 'Negative Perception', isDefault: false, description: 'Challenges or criticism' },
  { key: 'adThemes', label: 'Ad Themes', isDefault: false, description: 'Advertising themes' },
  { key: 'usp', label: 'USP', isDefault: false, description: 'Unique selling proposition' }
]

interface CompetitorColumnSelectorProps {
  selectedColumns: string[]
  onColumnsChange: (selectedColumns: string[]) => void
}

export function CompetitorColumnSelector({ selectedColumns, onColumnsChange }: CompetitorColumnSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleColumnToggle = (columnKey: string, isDefault: boolean) => {
    if (isDefault) return // Don't allow toggling default columns
    
    const updatedColumns = selectedColumns.includes(columnKey)
      ? selectedColumns.filter(col => col !== columnKey)
      : [...selectedColumns, columnKey]
    
    onColumnsChange(updatedColumns)
  }

  const defaultColumns = AVAILABLE_COLUMNS.filter(col => col.isDefault)
  const optionalColumns = AVAILABLE_COLUMNS.filter(col => !col.isDefault)
  const selectedOptionalCount = optionalColumns.filter(col => selectedColumns.includes(col.key)).length

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <Settings className="w-4 h-4 mr-2" />
          Columns
          {selectedOptionalCount > 0 && (
            <span className="ml-1 text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full">
              +{selectedOptionalCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-4">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm text-gray-900 mb-2">Table Columns</h4>
            <p className="text-xs text-gray-500 mb-3">
              Choose which columns to display in the competitor table
            </p>
          </div>

          {/* Default Columns (Always Visible) */}
          <div>
            <h5 className="text-xs font-medium text-gray-700 mb-2">Default Columns (Always Visible)</h5>
            <div className="space-y-2">
              {defaultColumns.map((column) => (
                <div key={column.key} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`col-${column.key}`}
                    checked={true}
                    disabled={true}
                    className="opacity-50"
                  />
                  <label 
                    htmlFor={`col-${column.key}`}
                    className="text-sm text-gray-600 opacity-75"
                  >
                    {column.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Optional Columns */}
          <div>
            <h5 className="text-xs font-medium text-gray-700 mb-2">Additional Columns</h5>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {optionalColumns.map((column) => (
                <div key={column.key} className="flex items-start space-x-2">
                  <Checkbox 
                    id={`col-${column.key}`}
                    checked={selectedColumns.includes(column.key)}
                    onCheckedChange={() => handleColumnToggle(column.key, column.isDefault)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <label 
                      htmlFor={`col-${column.key}`}
                      className="text-sm text-gray-900 cursor-pointer"
                    >
                      {column.label}
                    </label>
                    {column.description && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {column.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="pt-2 border-t">
            <p className="text-xs text-gray-500">
              Showing {defaultColumns.length + selectedOptionalCount} of {AVAILABLE_COLUMNS.length} columns
            </p>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Export column configuration for use in the table component
export { AVAILABLE_COLUMNS, type ColumnConfig, type CompetitorColumnData }