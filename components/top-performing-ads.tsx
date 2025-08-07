"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, TrendingUp, MousePointer, Eye, ArrowUpDown } from "lucide-react"
import { AdDetail } from "@/lib/data/ads-details"
import Image from "next/image"
import { useState } from "react"
import React from "react"

interface TopPerformingAdsProps {
  ads: AdDetail[]
  title?: string
}

type SortMetric = 'roas' | 'ctr' | 'clicks' | 'impressions' | 'reach' | 'spend'

export function TopPerformingAds({ ads, title = "Top 10 Performing Ads" }: TopPerformingAdsProps) {
  const [sortMetric, setSortMetric] = useState<SortMetric>('roas')
  const [sortedAds, setSortedAds] = useState(ads)

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return (value * 100).toFixed(2) + '%'
  }

  const getObjectiveBadgeColor = (objective: string) => {
    switch (objective) {
      case 'OUTCOME_LEADS':
        return 'bg-blue-100 text-blue-800'
      case 'OUTCOME_TRAFFIC':
        return 'bg-green-100 text-green-800'
      case 'OUTCOME_AWARENESS':
        return 'bg-blue-100 text-blue-800'
      case 'OUTCOME_SALES':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleSort = (metric: SortMetric) => {
    setSortMetric(metric)
    const sorted = [...ads].sort((a, b) => b[metric] - a[metric])
    setSortedAds(sorted)
  }

  const getMetricLabel = (metric: SortMetric) => {
    switch (metric) {
      case 'roas': return 'ROAS'
      case 'ctr': return 'CTR'
      case 'clicks': return 'Clicks'
      case 'impressions': return 'Impressions'
      case 'reach': return 'Reach'
      case 'spend': return 'Spend'
      default: return metric
    }
  }

  // Initialize sorted ads on first render
  React.useEffect(() => {
    const sorted = [...ads].sort((a, b) => b[sortMetric] - a[sortMetric])
    setSortedAds(sorted)
  }, [ads, sortMetric])

  if (ads.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-4 mt-6">{title}</h2>
        <Card className="p-6 border-2 border-[#d1d1d6] shadow-sm bg-white">
          <div className="text-center text-[#8e8e93]">
            No ads data available
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4 mt-6">{title}</h2>
      <Card className="border-2 border-[#d1d1d6] shadow-sm bg-white">
        <div className="p-4 border-b border-[#f0f0f0]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#8e8e93]">
              Showing {ads.length} top performing ads
            </span>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent"
                  >
                    <ArrowUpDown className="mr-2 h-4 w-4" />
                    Sort by {getMetricLabel(sortMetric)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleSort('roas')}>
                    Sort by ROAS
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort('ctr')}>
                    Sort by CTR
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort('clicks')}>
                    Sort by Clicks
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort('impressions')}>
                    Sort by Impressions
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort('reach')}>
                    Sort by Reach
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort('spend')}>
                    Sort by Spend
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                className="border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent"
              >
                Export Data
              </Button>
            </div>
          </div>
        </div>
        
        <div className="max-h-[600px] overflow-y-auto">
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {sortedAds.map((ad, index) => (
                <Card key={ad.id} className="border border-[#f0f0f0] hover:shadow-md transition-shadow">
                  <div className="p-4">
                    {/* Ad Thumbnail */}
                    <div className="relative w-full h-32 rounded-lg overflow-hidden bg-gray-100 mb-3">
                      {ad.thumbnail_url ? (
                        <Image
                          src={ad.thumbnail_url}
                          alt={ad.name}
                          fill
                          className="object-cover"
                          onError={(e) => {
                            // Replace with placeholder on error
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            target.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full flex items-center justify-center text-gray-400 ${ad.thumbnail_url ? 'hidden' : ''}`}>
                        <Eye className="w-8 h-8" />
                      </div>
                      {/* Ranking Badge */}
                      <div className="absolute top-2 left-2">
                        <span className="text-xs font-medium text-white bg-black bg-opacity-70 px-2 py-1 rounded">
                          #{index + 1}
                        </span>
                      </div>
                      {/* More Options */}
                      <div className="absolute top-2 right-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-white bg-black bg-opacity-50 hover:bg-opacity-70">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(ad.id)}>
                              Copy Ad ID
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Ad Header */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={`text-xs ${getObjectiveBadgeColor(ad.objective)}`}>
                          {ad.objective.replace('OUTCOME_', '')}
                        </Badge>
                        <span className="text-xs text-[#8e8e93]">
                          {ad.platform}
                        </span>
                      </div>
                      <h3 className="text-sm font-medium text-black line-clamp-2 mb-1">
                        {ad.name}
                      </h3>
                      {ad.message && (
                        <p className="text-xs text-[#666] line-clamp-2">
                          {ad.message}
                        </p>
                      )}
                    </div>

                    {/* Key Metrics */}
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-green-600" />
                          <span className="text-xs text-[#8e8e93]">ROAS</span>
                        </div>
                        <span className="text-sm font-medium text-green-600">
                          {ad.roas.toFixed(2)}x
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <MousePointer className="w-3 h-3 text-blue-600" />
                          <span className="text-xs text-[#8e8e93]">CTR</span>
                        </div>
                        <span className="text-sm font-medium text-blue-600">
                          {formatPercentage(ad.ctr)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#8e8e93]">Spend</span>
                        <span className="text-sm font-medium">
                          {formatCurrency(ad.spend)}
                        </span>
                      </div>
                    </div>

                    {/* Additional Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-[#f0f0f0]">
                      <div>
                        <div className="text-[#8e8e93]">Reach</div>
                        <div className="font-medium">{formatNumber(ad.reach)}</div>
                      </div>
                      <div>
                        <div className="text-[#8e8e93]">Clicks</div>
                        <div className="font-medium">{formatNumber(ad.clicks)}</div>
                      </div>
                      <div>
                        <div className="text-[#8e8e93]">Impressions</div>
                        <div className="font-medium">{formatNumber(ad.impressions)}</div>
                      </div>
                      <div>
                        <div className="text-[#8e8e93]">CPC</div>
                        <div className="font-medium">{formatCurrency(ad.cpc)}</div>
                      </div>
                    </div>

                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}