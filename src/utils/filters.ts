import {
  adjustBrightness,
  adjustContrast,
  adjustSaturation,
  applyBlur,
  applyGrayscale,
  applyInvert,
  applySepia,
  applySharpen,
} from "./imageProcessing";

export type BasicFilterId =
  | "brightness"
  | "contrast"
  | "saturation"
  | "grayscale"
  | "sepia"
  | "invert"
  | "blur"
  | "sharpen"
  | "vintage"
  | "cold"
  | "warm"
  | "dramatic";

// Apply a basic filter directly to a layer's canvas, in place.
export function applyBasicFilterToCanvas(canvas: HTMLCanvasElement, id: BasicFilterId): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  let img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  switch (id) {
    case "brightness":
      img = adjustBrightness(img, 0.2);
      break;
    case "contrast":
      img = adjustContrast(img, 0.3);
      break;
    case "saturation":
      img = adjustSaturation(img, 0.5);
      break;
    case "grayscale":
      img = applyGrayscale(img);
      break;
    case "sepia":
      img = applySepia(img);
      break;
    case "invert":
      img = applyInvert(img);
      break;
    case "blur":
      img = applyBlur(img, 2);
      break;
    case "sharpen":
      img = applySharpen(img);
      break;
    case "vintage":
      img = applySepia(img);
      img = adjustSaturation(img, -0.2);
      img = adjustContrast(img, -0.1);
      break;
    case "cold":
      img = adjustTemperature(img, -0.3);
      break;
    case "warm":
      img = adjustTemperature(img, 0.3);
      break;
    case "dramatic":
      img = adjustContrast(img, 0.5);
      img = adjustSaturation(img, 0.3);
      break;
  }
  ctx.putImageData(img, 0, 0);
}

function adjustTemperature(imageData: ImageData, amount: number): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  for (let i = 0; i < data.length; i += 4) {
    if (amount > 0) {
      data[i] = Math.min(255, data[i] * (1 + amount * 0.3));
      data[i + 1] = Math.min(255, data[i + 1] * (1 + amount * 0.1));
    } else {
      data[i + 2] = Math.min(255, data[i + 2] * (1 + Math.abs(amount) * 0.3));
      data[i + 1] = Math.min(255, data[i + 1] * (1 + Math.abs(amount) * 0.1));
    }
  }
  return new ImageData(data, imageData.width, imageData.height);
}
