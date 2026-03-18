// AI-powered image generation and filtering using external APIs

interface OpenAIResponse {
  data: {
    url: string;
  }[];
}

interface HuggingFaceResponse {
  // Response format depends on the specific model used
  [key: string]: any;
}

// Generate AI filter using OpenAI's image editing capabilities
export async function generateAIFilter(image: HTMLImageElement, prompt: string): Promise<HTMLImageElement> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
  }

  try {
    // Convert image to base64
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);
    
    const imageBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
      }, 'image/png');
    });

    // Create form data for OpenAI API
    const formData = new FormData();
    formData.append('image', imageBlob);
    formData.append('prompt', `Apply this style to the image: ${prompt}`);
    formData.append('n', '1');
    formData.append('size', '1024x1024');

    // Make request to OpenAI API
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data: OpenAIResponse = await response.json();
    
    if (!data.data || data.data.length === 0) {
      throw new Error('No image returned from OpenAI API');
    }

    // Load the generated image
    const generatedImage = new Image();
    generatedImage.crossOrigin = 'anonymous';
    
    return new Promise((resolve, reject) => {
      generatedImage.onload = () => resolve(generatedImage);
      generatedImage.onerror = () => reject(new Error('Failed to load generated image'));
      generatedImage.src = data.data[0].url;
    });
    
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

// Use Hugging Face models for image processing
export async function applyHuggingFaceFilter(image: HTMLImageElement, modelId: string): Promise<HTMLImageElement> {
  const apiKey = import.meta.env.VITE_HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY;
  
  if (!apiKey) {
    throw new Error('Hugging Face API key not configured. Please set HUGGINGFACE_API_KEY environment variable.');
  }

  try {
    // Convert image to blob
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);
    
    const imageBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
      }, 'image/jpeg', 0.8);
    });

    // Make request to Hugging Face API
    const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: imageBlob
    });

    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.statusText}`);
    }

    // Handle different response types based on model
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('image/')) {
      // Model returns an image
      const imageBlob = await response.blob();
      const imageUrl = URL.createObjectURL(imageBlob);
      
      const processedImage = new Image();
      processedImage.crossOrigin = 'anonymous';
      
      return new Promise((resolve, reject) => {
        processedImage.onload = () => {
          URL.revokeObjectURL(imageUrl);
          resolve(processedImage);
        };
        processedImage.onerror = () => {
          URL.revokeObjectURL(imageUrl);
          reject(new Error('Failed to load processed image'));
        };
        processedImage.src = imageUrl;
      });
    } else {
      // Model returns JSON or other format
      const data = await response.json();
      console.log('Hugging Face response:', data);
      throw new Error('Model did not return an image');
    }
    
  } catch (error) {
    console.error('Hugging Face API error:', error);
    throw error;
  }
}

// Predefined AI filter configurations
export const AI_FILTER_CONFIGS = {
  'style-transfer': {
    service: 'huggingface',
    model: 'runwayml/stable-diffusion-v1-5',
    prompt: 'artistic style transfer'
  },
  'enhance': {
    service: 'huggingface',
    model: 'tencentarc/gfpgan',
    prompt: 'enhance image quality'
  },
  'colorize': {
    service: 'huggingface',
    model: 'microsoft/DialoGPT-medium',
    prompt: 'colorize black and white image'
  },
  'restore': {
    service: 'huggingface',
    model: 'tencentarc/gfpgan',
    prompt: 'restore old damaged image'
  },
  'upscale': {
    service: 'openai',
    prompt: 'upscale image while maintaining quality'
  },
  'remove-noise': {
    service: 'huggingface',
    model: 'tencentarc/gfpgan',
    prompt: 'remove noise from image'
  }
};

// Apply predefined AI filter
export async function applyPredefinedAIFilter(image: HTMLImageElement, filterId: string): Promise<HTMLImageElement> {
  const config = AI_FILTER_CONFIGS[filterId as keyof typeof AI_FILTER_CONFIGS];
  
  if (!config) {
    throw new Error(`Unknown AI filter: ${filterId}`);
  }

  if (config.service === 'openai') {
    return generateAIFilter(image, config.prompt);
  } else if (config.service === 'huggingface' && config.model) {
    return applyHuggingFaceFilter(image, config.model);
  } else {
    throw new Error(`Invalid filter configuration for: ${filterId}`);
  }
}

// Batch process multiple images with AI
export async function batchProcessImages(
  images: HTMLImageElement[],
  prompt: string,
  onProgress?: (completed: number, total: number) => void
): Promise<HTMLImageElement[]> {
  const results: HTMLImageElement[] = [];
  
  for (let i = 0; i < images.length; i++) {
    try {
      const processedImage = await generateAIFilter(images[i], prompt);
      results.push(processedImage);
      
      if (onProgress) {
        onProgress(i + 1, images.length);
      }
      
      // Add delay to avoid rate limiting
      if (i < images.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Failed to process image ${i + 1}:`, error);
      // Add original image if processing fails
      results.push(images[i]);
    }
  }
  
  return results;
}

// Check API availability and keys
export function checkAPIAvailability(): {
  openai: boolean;
  huggingface: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const huggingfaceKey = import.meta.env.VITE_HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY;
  
  if (!openaiKey) {
    errors.push('OpenAI API key not configured');
  }
  
  if (!huggingfaceKey) {
    errors.push('Hugging Face API key not configured');
  }
  
  return {
    openai: !!openaiKey,
    huggingface: !!huggingfaceKey,
    errors
  };
}