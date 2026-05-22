// Shared types across AI providers.

export interface ImageInput {
  // Base-64 PNG without the data URL prefix.
  base64Png: string;
}

export interface ImageOutput {
  base64Png: string;
  width: number;
  height: number;
}

export interface GenerateOptions {
  prompt: string;
  width?: number;
  height?: number;
  count?: number;
}

export interface EditOptions {
  prompt: string;
  image: ImageInput;
  mask?: ImageInput;
}

export interface RemoveBgOptions {
  image: ImageInput;
}

export interface ImageProvider {
  id: string;
  name: string;
  generate?(opts: GenerateOptions): Promise<ImageOutput[]>;
  edit?(opts: EditOptions): Promise<ImageOutput[]>;
  removeBackground?(opts: RemoveBgOptions): Promise<ImageOutput>;
  upscale?(opts: { image: ImageInput; scale: number }): Promise<ImageOutput>;
}
