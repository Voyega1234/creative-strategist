import { NextResponse } from 'next/server';
import { getStorageClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      image_url, 
      filename, 
      client_name, 
      product_focus, 
      search_prompt, 
      selected_topics,
      source 
    } = body;

    if (!image_url) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: image_url' 
      }, { status: 400 });
    }

    // For Pinterest, client_name is required. For Facebook, it's optional
    if (source === 'pinterest' && !client_name) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: client_name (required for Pinterest images)' 
      }, { status: 400 });
    }

    console.log(`[save-reference-image] Saving ${source || 'reference'} image:`, {
      filename,
      client_name: client_name || 'N/A',
      product_focus: product_focus || 'N/A',
      search_prompt: search_prompt?.substring(0, 100),
      selected_topics: selected_topics?.length || 0,
      source: source || 'unknown'
    });

    // Download the image from source
    const imageResponse = await fetch(image_url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image from ${source || 'source'}`);
    }

    const imageBlob = await imageResponse.blob();

    // Generate unique filename with timestamp (following the same pattern as image-upload)
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 9);
    const fileExtension = filename?.split('.').pop() || 'jpg';
    const uniqueFilename = `${timestamp}-${randomId}.${fileExtension}`;
    const fullPath = `references/${uniqueFilename}`;

    console.log('[save-reference-image] Uploading to path:', fullPath);
    console.log('[save-reference-image] File size:', imageBlob.size);
    console.log('[save-reference-image] File type:', imageBlob.type);

    // Upload to Supabase storage following the exact same pattern as image-upload
    const storageClient = getStorageClient();
    const { data, error } = await storageClient
      .from('ads-creative-image')
      .upload(fullPath, imageBlob);

    if (error) {
      console.error('[save-reference-image] Upload error:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    console.log('[save-reference-image] Upload successful:', {
      id: data.id,
      path: data.path,
      fullPath: data.fullPath
    });

    // Get the public URL
    const { data: urlData } = storageClient
      .from('ads-creative-image')
      .getPublicUrl(data.path);

    return NextResponse.json({
      success: true,
      image: {
        filename: uniqueFilename,
        path: data.path,
        url: urlData.publicUrl,
        client_name,
        product_focus,
        original_url: image_url
      }
    });

  } catch (error: any) {
    console.error('[save-reference-image] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to save reference image'
    }, { status: 500 });
  }
}