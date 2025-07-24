"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"
import { CompetitorColumnSelector, AVAILABLE_COLUMNS, type ColumnConfig } from "./competitor-column-selector"
import { normalizeToArray } from "@/lib/utils"
import type { Competitor } from "@/lib/data/competitors"

interface CompetitorTableProps {
  competitors: Competitor[]
  clientName?: string
}

export function CompetitorTable({ competitors, clientName }: CompetitorTableProps) {
  // Filter out the client from competitors list
  const filteredCompetitors = competitors.filter(competitor => {
    if (!clientName || !competitor.name) return true
    // Use case-insensitive comparison and check for partial matches
    return !competitor.name.toLowerCase().includes(clientName.toLowerCase()) &&
           !clientName.toLowerCase().includes(competitor.name.toLowerCase())
  })

  // Start with only default columns selected
  const defaultColumns = AVAILABLE_COLUMNS.filter(col => col.isDefault).map(col => col.key)
  const [selectedColumns, setSelectedColumns] = useState<string[]>(defaultColumns)

  // Get all columns to display (default + selected optional)
  const columnsToShow = AVAILABLE_COLUMNS.filter(col => 
    col.isDefault || selectedColumns.includes(col.key)
  )

  // Render cell content based on column type
  const renderCellContent = (competitor: Competitor, column: ColumnConfig) => {
    const value = competitor[column.key]
    
    if (!value) return <span className="text-gray-400">-</span>

    // Handle array fields
    if (column.key === 'services' || column.key === 'serviceCategories' || 
        column.key === 'features' || column.key === 'strengths' || 
        column.key === 'weaknesses' || column.key === 'adThemes') {
      const items = normalizeToArray(value)
      if (column.key === 'services' || column.key === 'serviceCategories' || 
          column.key === 'features' || column.key === 'adThemes') {
        return (
          <div className="flex flex-wrap gap-1">
            {items.map((item: string, i: number) => (
              <Badge
                key={i}
                variant="outline"
                className="border-[#d1d1d6] text-[#8e8e93] bg-[#f2f2f7] px-2 py-0.5 text-xs font-normal"
              >
                {item}
              </Badge>
            ))}
          </div>
        )
      } else {
        // Strengths, weaknesses as list
        return (
          <ul className="list-disc pl-4 space-y-0.5">
            {items.map((item: string, i: number) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )
      }
    }

    // Handle URL fields
    if (column.key === 'website' || column.key === 'facebookUrl') {
      return (
        <a 
          href={value} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline truncate block max-w-32"
        >
          {column.key === 'website' ? 'Visit' : 'Facebook'}
        </a>
      )
    }

    // Handle pricing (could be array or string)
    if (column.key === 'pricing') {
      const items = normalizeToArray(value)
      return (
        <ul className="list-disc pl-4 space-y-0.5">
          {items.map((item: string, i: number) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )
    }

    // Default: show as text
    return <span className="line-clamp-3">{String(value)}</span>
  }

  // Generate grid columns CSS based on selected columns
  const generateGridCols = () => {
    const colCount = columnsToShow.length + 1 // +1 for actions column only
    return `repeat(${colCount - 1}, minmax(120px, 1fr)) auto`
  }

  return (
    <Card className="p-6 border border-[#d1d1d6] shadow-sm bg-white">
      {/* Header with Column Selector */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Competitors</h3>
        <CompetitorColumnSelector 
          selectedColumns={selectedColumns}
          onColumnsChange={setSelectedColumns}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <div 
          className="grid gap-x-4 gap-y-2 items-center text-sm font-medium text-black border-b pb-2 mb-2"
          style={{ gridTemplateColumns: generateGridCols() }}
        >
          {columnsToShow.map((column) => (
            <div key={column.key} className="flex items-center">
              {column.label}
              {column.key === 'pricing' && (
                <span className="ml-1 text-[#8e8e93]">↑↓</span>
              )}
            </div>
          ))}
          <div className="w-4"></div> {/* Actions column */}
        </div>

        {/* Competitor Rows */}
        {filteredCompetitors.map((competitor) => (
          <div
            key={competitor.id}
            className="grid gap-x-4 gap-y-2 items-start text-sm text-[#8e8e93] py-2 border-b last:border-b-0"
            style={{ gridTemplateColumns: generateGridCols() }}
          >
            {columnsToShow.map((column) => (
              <div key={column.key} className={column.key === 'name' ? 'font-medium text-black' : ''}>
                {renderCellContent(competitor, column)}
              </div>
            ))}
            
            <div className="pt-1">
              <DropdownMenu>
                <DropdownMenuTrigger className="p-1 hover:bg-gray-100 rounded">
                  <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>View Details</DropdownMenuItem>
                  <DropdownMenuItem>Edit</DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600">Remove</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}

        {filteredCompetitors.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No competitors found
          </div>
        )}
      </div>
    </Card>
  )
}