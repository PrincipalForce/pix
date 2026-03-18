import {
  imageToImageData,
  imageDataToImage,
  adjustBrightness,
  adjustContrast,
  adjustSaturation,
  applyGrayscale,
  applySepia,
  applyInvert,
  applyBlur,
  applySharpen
} from './imageProcessing';

// Basic filter functions
export async function applyFilter(image: HTMLImageElement, filterId: string): Promise<HTMLImageElement> {
  let imageData = imageToImageData(image);
  
  switch (filterId) {
    case 'brightness':
      imageData = adjustBrightness(imageData, 0.3);
      break;
    case 'contrast':
      imageData = adjustContrast(imageData, 0.3);
      break;
    case 'saturation':
      imageData = adjustSaturation(imageData, 0.5);
      break;
    case 'grayscale':
      imageData = applyGrayscale(imageData);
      break;
    case 'sepia':
      imageData = applySepia(imageData);
      break;
    case 'invert':
      imageData = applyInvert(imageData);
      break;
    case 'blur':
      imageData = applyBlur(imageData, 2);
      break;
    case 'sharpen':
      imageData = applySharpen(imageData);
      break;
    case 'vintage':
      // Combine sepia with reduced saturation and contrast
      imageData = applySepia(imageData);
      imageData = adjustSaturation(imageData, -0.2);
      imageData = adjustContrast(imageData, -0.1);
      break;
    case 'cold':
      // Enhance blue tones
      imageData = adjustTemperature(imageData, -0.3);
      break;
    case 'warm':
      // Enhance red/yellow tones
      imageData = adjustTemperature(imageData, 0.3);
      break;
    case 'dramatic':
      // High contrast with saturation boost
      imageData = adjustContrast(imageData, 0.5);
      imageData = adjustSaturation(imageData, 0.3);
      break;
    default:
      throw new Error(`Unknown filter: ${filterId}`);
  }
  
  return imageDataToImage(imageData);
}

// AI filter functions (using APIs or client-side processing)
export async function applyAIFilter(image: HTMLImageElement, filterId: string): Promise<HTMLImageElement> {
  switch (filterId) {
    case 'style-transfer':
      return await applyStyleTransfer(image);
    case 'enhance':
      return await enhanceWithAI(image);
    case 'colorize':
      return await colorizeImage(image);
    case 'restore':
      return await restoreImage(image);
    case 'upscale':
      return await upscaleImage(image);
    case 'remove-noise':
      return await removeNoise(image);
    default:
      throw new Error(`Unknown AI filter: ${filterId}`);
  }
}

// Temperature adjustment helper
function adjustTemperature(imageData: ImageData, amount: number): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  
  for (let i = 0; i < data.length; i += 4) {
    if (amount > 0) {
      // Warm: increase reds and yellows
      data[i] = Math.min(255, data[i] * (1 + amount * 0.3)); // Red
      data[i + 1] = Math.min(255, data[i + 1] * (1 + amount * 0.1)); // Green
      // Blue stays the same or slightly reduced
    } else {
      // Cold: increase blues
      data[i + 2] = Math.min(255, data[i + 2] * (1 + Math.abs(amount) * 0.3)); // Blue
      data[i + 1] = Math.min(255, data[i + 1] * (1 + Math.abs(amount) * 0.1)); // Green
      // Red stays the same or slightly reduced
    }
  }
  
  return new ImageData(data, imageData.width, imageData.height);
}

// AI Filter implementations (mock implementations - would use real APIs in production)
async function applyStyleTransfer(image: HTMLImageElement): Promise<HTMLImageElement> {
  // This would typically use a service like RunwayML or a custom model
  // For demo purposes, apply artistic effect
  let imageData = imageToImageData(image);
  imageData = adjustSaturation(imageData, 0.5);
  imageData = adjustContrast(imageData, 0.3);
  imageData = applyBlur(imageData, 1);
  return imageDataToImage(imageData);
}

async function enhanceWithAI(image: HTMLImageElement): Promise<HTMLImageElement> {
  // AI enhancement - improve contrast, sharpness, and color balance
  let imageData = imageToImageData(image);
  imageData = adjustContrast(imageData, 0.2);
  imageData = applySharpen(imageData);
  imageData = adjustSaturation(imageData, 0.15);
  return imageDataToImage(imageData);
}

async function colorizeImage(image: HTMLImageElement): Promise<HTMLImageElement> {
  // Convert grayscale to color (simplified)
  let imageData = imageToImageData(image);
  // Add subtle color tinting
  const data = new Uint8ClampedArray(imageData.data);
  
  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i] = Math.min(255, gray * 1.1); // Slight red tint
    data[i + 1] = Math.min(255, gray * 1.0);
    data[i + 2] = Math.min(255, gray * 0.9); // Reduce blue
  }
  
  return imageDataToImage(new ImageData(data, imageData.width, imageData.height));
}

async function restoreImage(image: HTMLImageElement): Promise<HTMLImageElement> {
  // Image restoration - reduce noise, enhance details
  let imageData = imageToImageData(image);
  // Apply slight blur to reduce noise, then sharpen to restore details
  imageData = applyBlur(imageData, 1);
  imageData = applySharpen(imageData);
  imageData = adjustContrast(imageData, 0.1);
  return imageDataToImage(imageData);
}

async function upscaleImage(image: HTMLImageElement): Promise<HTMLImageElement> {
  // Simple 2x upscaling using canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  
  canvas.width = image.width * 2;
  canvas.height = image.height * 2;
  
  // Use image smoothing for basic upscaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  
  return new Promise((resolve, reject) => {
    const upscaledImage = new Image();
    upscaledImage.onload = () => resolve(upscaledImage);
    upscaledImage.onerror = reject;
    upscaledImage.src = canvas.toDataURL();
  });
}

async function removeNoise(image: HTMLImageElement): Promise<HTMLImageElement> {
  // Noise removal using blur and selective sharpening
  let imageData = imageToImageData(image);
  imageData = applyBlur(imageData, 1);
  // Apply mild sharpening to restore important details
  const data = new Uint8ClampedArray(imageData.data);
  const original = imageToImageData(image).data;
  
  // Selective sharpening - only where there's significant detail
  for (let i = 0; i < data.length; i += 4) {
    const originalIntensity = (original[i] + original[i + 1] + original[i + 2]) / 3;
    const blurredIntensity = (data[i] + data[i + 1] + data[i + 2]) / 3;
    
    if (Math.abs(originalIntensity - blurredIntensity) > 20) {
      // Restore some detail in high-contrast areas
      data[i] = Math.min(255, data[i] * 1.1);
      data[i + 1] = Math.min(255, data[i + 1] * 1.1);
      data[i + 2] = Math.min(255, data[i + 2] * 1.1);
    }
  }
  
  return imageDataToImage(new ImageData(data, imageData.width, imageData.height));
}