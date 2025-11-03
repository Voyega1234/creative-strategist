"use client"

import { useState, useEffect } from "react"
import { Heart, MessageCircle, Share, MoreHorizontal, Globe, ChevronLeft, ChevronRight } from "lucide-react"

interface FacebookPostProps {
  data: Array<{
    content?: string
    image_url?: string
    page_name?: string
    [key: string]: any
  }> | {
    content?: string
    image_url?: string
    page_name?: string
    [key: string]: any
  }
}

export function FacebookPost({ data }: FacebookPostProps) {
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(Math.floor(Math.random() * 500) + 50)
  const [comments, setComments] = useState(Math.floor(Math.random() * 50) + 5)
  const [shares, setShares] = useState(Math.floor(Math.random() * 20) + 2)
  const [currentCaptionIndex, setCurrentCaptionIndex] = useState(0)

  const handleLike = () => {
    setLiked(!liked)
    setLikes(prev => liked ? prev - 1 : prev + 1)
  }

  // Get current date in Facebook format
  const getFormattedDate = () => {
    const now = new Date()
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }
    return now.toLocaleDateString('en-US', options)
  }

  // Handle both array and object formats from N8N API
  const postData = Array.isArray(data) ? data[0] : data

  const pageName = postData?.page_name || "Your Business Page"
  const defaultCaption = postData?.content || postData?.caption || "Generated Facebook post content will appear here..."
  const imageUrl = postData?.image_url
  const captions = Array.isArray(postData?.captions) ? postData.captions : []

  useEffect(() => {
    if (captions.length === 0) {
      setCurrentCaptionIndex(0)
    } else if (currentCaptionIndex >= captions.length) {
      setCurrentCaptionIndex(0)
    }
  }, [captions.length, currentCaptionIndex])

  const activeCaptionData = captions.length > 0 ? captions[currentCaptionIndex] : null
  const caption = activeCaptionData?.caption || defaultCaption
  const activeStrategy = activeCaptionData?.strategy

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm max-w-[500px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3">
        <div className="flex items-center space-x-3">
          {/* Profile Picture */}
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
            {pageName.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-1">
              <span className="font-semibold text-[15px] text-gray-900 hover:underline cursor-pointer">
                {pageName}
              </span>
            </div>
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <span>{getFormattedDate()}</span>
              <span>·</span>
              <Globe className="w-3 h-3" />
            </div>
          </div>
        </div>
        <button className="p-2 hover:bg-gray-100 rounded-full">
          <MoreHorizontal className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Post Content */}
      <div className="px-4 pb-3">
        {captions.length > 0 && (
          <div className="flex items-center justify-between mb-3 bg-gray-50 rounded-md px-3 py-2">
            <button
              onClick={() => setCurrentCaptionIndex(prev => Math.max(prev - 1, 0))}
              disabled={currentCaptionIndex === 0}
              className={`p-1 rounded-full ${currentCaptionIndex === 0 ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'}`}
              aria-label="Previous caption"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center gap-1 text-sm">
              <span className="font-medium text-gray-700">
                Caption {currentCaptionIndex + 1} / {captions.length}
              </span>
              {activeStrategy && (
                <span className="text-xs uppercase tracking-wide text-blue-600 font-semibold">
                  {activeStrategy}
                </span>
              )}
            </div>
            <button
              onClick={() => setCurrentCaptionIndex(prev => Math.min(prev + 1, captions.length - 1))}
              disabled={currentCaptionIndex === captions.length - 1}
              className={`p-1 rounded-full ${currentCaptionIndex === captions.length - 1 ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'}`}
              aria-label="Next caption"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="text-[15px] text-gray-900 leading-5 space-y-2">
          {caption.split('\n').map((line, index) => {
            // Handle different formatting
            if (line.trim() === '') {
              return <div key={index} className="h-2"></div>
            }
            
            // Handle bold text (text between **)
            const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            
            // Handle checkmarks
            const withCheckmarks = formattedLine.replace(/:white_check_mark:/g, '✅')
            
            // Handle links (remove the markdown link format but keep the text)
            const withoutLinks = withCheckmarks.replace(/\[(.*?)\]\((.*?)\)/g, '$1')
            
            return (
              <div 
                key={index} 
                className="leading-5"
                dangerouslySetInnerHTML={{ __html: withoutLinks }}
              />
            )
          })}
        </div>
      </div>

      {/* Image */}
      {imageUrl && (
        <div className="w-full">
          <img 
            src={imageUrl} 
            alt="Post content"
            className="w-full h-auto object-cover"
            onError={(e) => {
              // Fallback to placeholder if image fails to load
              const target = e.target as HTMLImageElement
              target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='300' viewBox='0 0 500 300'%3E%3Crect width='500' height='300' fill='%23f0f2f5'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial, sans-serif' font-size='16' fill='%23666'%3EImage Preview%3C/text%3E%3C/svg%3E"
            }}
          />
        </div>
      )}

      {/* Reaction Stats */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <div className="flex items-center space-x-1">
          <div className="flex items-center">
            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mr-1">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
              </svg>
            </div>
            <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center -ml-1">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <span className="text-sm text-gray-600 ml-2 hover:underline cursor-pointer">
            {likes.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <span className="hover:underline cursor-pointer">{comments} comments</span>
          <span className="hover:underline cursor-pointer">{shares} shares</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-around py-2 px-4">
        <button 
          onClick={handleLike}
          className={`flex items-center space-x-2 py-2 px-4 rounded-md hover:bg-gray-100 flex-1 justify-center transition-colors ${
            liked ? 'text-blue-500' : 'text-gray-600'
          }`}
        >
          <svg 
            className={`w-5 h-5 ${liked ? 'fill-blue-500' : 'fill-none stroke-current'}`} 
            viewBox="0 0 24 24" 
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
          </svg>
          <span className="font-medium text-sm">Like</span>
        </button>
        
        <button className="flex items-center space-x-2 py-2 px-4 rounded-md hover:bg-gray-100 flex-1 justify-center text-gray-600">
          <MessageCircle className="w-5 h-5" />
          <span className="font-medium text-sm">Comment</span>
        </button>
        
        <button className="flex items-center space-x-2 py-2 px-4 rounded-md hover:bg-gray-100 flex-1 justify-center text-gray-600">
          <Share className="w-5 h-5" />
          <span className="font-medium text-sm">Share</span>
        </button>
      </div>

      {/* Write a comment section */}
      <div className="border-t border-gray-100 p-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 text-xs font-bold">
            You
          </div>
          <div className="flex-1 bg-gray-100 rounded-full px-4 py-2">
            <input 
              type="text" 
              placeholder="Write a comment..." 
              className="w-full bg-transparent text-sm outline-none text-gray-600"
              readOnly
            />
          </div>
        </div>
      </div>
    </div>
  )
}
