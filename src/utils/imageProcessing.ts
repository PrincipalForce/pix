export interface ImageProcessingOptions {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  blur?: number;
  sharpen?: number;
}

// Convert image to ImageData for processing
export function imageToImageData(img: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = img.width || img.naturalWidth;
  canvas.height = img.height || img.naturalHeight;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// Convert ImageData back to HTMLImageElement
export function imageDataToImage(imageData: ImageData): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = canvas.toDataURL();
  });
}

// Apply brightness adjustment
export function adjustBrightness(imageData: ImageData, amount: number): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  const brightness = Math.round(amount * 255);
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, data[i] + brightness));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + brightness));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + brightness));
  }
  
  return new ImageData(data, imageData.width, imageData.height);
}

// Apply contrast adjustment
export function adjustContrast(imageData: ImageData, amount: number): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  const contrast = (amount + 1);
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, contrast * (data[i] - 128) + 128));
    data[i + 1] = Math.min(255, Math.max(0, contrast * (data[i + 1] - 128) + 128));
    data[i + 2] = Math.min(255, Math.max(0, contrast * (data[i + 2] - 128) + 128));
  }
  
  return new ImageData(data, imageData.width, imageData.height);
}

// Convert RGB to HSL
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h: number;
  let s: number;
  const l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: h = 0;
    }
    h /= 6;
  }
  
  return [h, s, l];
}

// Convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number;
  let g: number;
  let b: number;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return [r * 255, g * 255, b * 255];
}

// Apply saturation adjustment
export function adjustSaturation(imageData: ImageData, amount: number): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    const newS = Math.min(1, Math.max(0, s * (1 + amount)));
    const [r, g, b] = hslToRgb(h, newS, l);
    
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  
  return new ImageData(data, imageData.width, imageData.height);
}

// Apply grayscale filter
export function applyGrayscale(imageData: ImageData): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  
  return new ImageData(data, imageData.width, imageData.height);
}

// Apply sepia filter
export function applySepia(imageData: ImageData): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
    data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
    data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
  }
  
  return new ImageData(data, imageData.width, imageData.height);
}

// Apply invert filter
export function applyInvert(imageData: ImageData): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
  
  return new ImageData(data, imageData.width, imageData.height);
}

// Apply blur filter (simple box blur)
export function applyBlur(imageData: ImageData, radius: number = 1): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  const { width, height } = imageData;
  const original = new Uint8ClampedArray(imageData.data);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      let count = 0;
      
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const idx = (ny * width + nx) * 4;
            r += original[idx];
            g += original[idx + 1];
            b += original[idx + 2];
            a += original[idx + 3];
            count++;
          }
        }
      }
      
      const idx = (y * width + x) * 4;
      data[idx] = r / count;
      data[idx + 1] = g / count;
      data[idx + 2] = b / count;
      data[idx + 3] = a / count;
    }
  }
  
  return new ImageData(data, width, height);
}

// Apply sharpen filter
export function applySharpen(imageData: ImageData): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  const { width, height } = imageData;
  const original = new Uint8ClampedArray(imageData.data);
  
  // Sharpen kernel
  const kernel = [
    [0, -1, 0],
    [-1, 5, -1],
    [0, -1, 0]
  ];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let r = 0, g = 0, b = 0;
      
      for (let ky = 0; ky < 3; ky++) {
        for (let kx = 0; kx < 3; kx++) {
          const idx = ((y + ky - 1) * width + (x + kx - 1)) * 4;
          const weight = kernel[ky][kx];
          
          r += original[idx] * weight;
          g += original[idx + 1] * weight;
          b += original[idx + 2] * weight;
        }
      }
      
      const idx = (y * width + x) * 4;
      data[idx] = Math.min(255, Math.max(0, r));
      data[idx + 1] = Math.min(255, Math.max(0, g));
      data[idx + 2] = Math.min(255, Math.max(0, b));
    }
  }
  
  return new ImageData(data, width, height);
}