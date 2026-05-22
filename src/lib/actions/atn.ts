// Photoshop .atn action set importer.
//
// The full .atn format is binary ActionDescriptors with many opaque operations.
// Implementing complete execution would require mapping every PS command, which is
// many hundreds of operations and isn't practical here. Instead we do a best-effort
// extraction:
//   - Pull readable Unicode strings (PS uses big-endian UTF-16 length-prefixed strings).
//   - Treat strings that look like action names as PixAction entries.
//   - Each "step" in the file becomes a step record. If we recognize the step name
//     (e.g. "Gaussian Blur", "Levels"), it maps to applyFilter with default params.
//   - Otherwise it becomes an `unsupported` step so the user can see what's in the file.

import { PixAction, Step } from "./types";

// Mapping from common Photoshop step names → our filter ids (with empty params: user can edit).
const ATN_STEP_MAP: Record<string, string> = {
  "Gaussian Blur": "gaussian-blur",
  "Motion Blur": "motion-blur",
  "Box Blur": "box-blur",
  "Radial Blur": "radial-blur",
  "Surface Blur": "surface-blur",
  "Unsharp Mask": "unsharp-mask",
  "Sharpen": "sharpen",
  "Find Edges": "find-edges",
  "Emboss": "emboss",
  "Solarize": "solarize",
  "Oil Paint": "oil-paint",
  "Add Noise": "add-noise",
  "Median": "median",
  "Despeckle": "despeckle",
  "Mosaic": "mosaic",
  "Crystallize": "crystallize",
  "Pointillize": "pointillize",
  "Pinch": "pinch",
  "Twirl": "twirl",
  "Spherize": "spherize",
  "Wave": "wave",
  "Levels": "levels",
  "Curves": "curves",
  "Brightness/Contrast": "brightness-contrast",
  "Brightness Contrast": "brightness-contrast",
  "Hue/Saturation": "hue-saturation",
  "Hue Saturation": "hue-saturation",
  "Color Balance": "color-balance",
  "Exposure": "exposure",
  "Black & White": "black-white",
  "Black and White": "black-white",
  "Photo Filter": "photo-filter",
  "Posterize": "posterize",
  "Threshold": "threshold",
  "Invert": "invert",
  "Desaturate": "grayscale",
  "Vibrance": "vibrance",
  "Gradient Map": "gradient-map",
  "Clouds": "clouds",
  "Lens Flare": "lens-flare",
  "High Pass": "high-pass",
};

export function parseAtn(buf: ArrayBuffer): PixAction[] {
  const u8 = new Uint8Array(buf);
  // Extract Unicode strings: PS encodes them as 4-byte big-endian length followed by length*2 bytes UTF-16 BE.
  const strings: string[] = [];
  for (let i = 0; i + 4 < u8.length; ) {
    const len = (u8[i] << 24) | (u8[i + 1] << 16) | (u8[i + 2] << 8) | u8[i + 3];
    if (len > 0 && len < 200 && i + 4 + len * 2 <= u8.length) {
      // Plausible: try decode
      let str = "";
      let bad = false;
      for (let k = 0; k < len; k++) {
        const hi = u8[i + 4 + k * 2];
        const lo = u8[i + 4 + k * 2 + 1];
        const code = (hi << 8) | lo;
        if (code === 0) {
          // PS strings are null-terminated; we accept that as end.
          if (k === len - 1) continue;
          bad = true;
          break;
        }
        if (code < 0x20 || code > 0xfffd) {
          bad = true;
          break;
        }
        str += String.fromCharCode(code);
      }
      if (!bad && str.length > 0 && /[A-Za-z]/.test(str)) {
        strings.push(str);
        i += 4 + len * 2;
        continue;
      }
    }
    i++;
  }

  // Heuristic grouping: first string is often the action set name; subsequent strings
  // alternate between action names and step names. We treat any string that matches a
  // known PS filter as a step, and other strings as candidate action names.
  // To keep it simple, expose a single PixAction containing every recognized step in order.
  const steps: Step[] = [];
  let bundleName = "Imported .atn";
  for (const s of strings) {
    if (ATN_STEP_MAP[s]) {
      steps.push({ type: "applyFilter", filterId: ATN_STEP_MAP[s], params: {} });
    } else if (s.length < 60 && !steps.length) {
      bundleName = s;
    } else {
      steps.push({ type: "unsupported", label: s });
    }
  }
  if (steps.length === 0) throw new Error("No recognizable actions found in .atn file.");
  return [
    {
      id: `atn-${Date.now()}`,
      name: bundleName,
      source: "atn",
      createdAt: Date.now(),
      steps,
    },
  ];
}
