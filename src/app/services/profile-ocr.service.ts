import { Injectable } from '@angular/core';
import { ProfileStats, ProfileOcrResult } from '../models/profile-stats';
import { parseProfileStats } from '../utils/profile-stats.parser';

declare const cv: any;

const MAX_IMAGE_WIDTH = 1200;

@Injectable({
  providedIn: 'root',
})
export class ProfileOcrService {
  async extractFromFile(file: File): Promise<ProfileOcrResult> {
    const { img, url } = await this.loadImage(file);
    let rawCanvas: HTMLCanvasElement;
    let binarizedCanvas: HTMLCanvasElement;
    try {
      rawCanvas = await this.scaleImage(img);
      binarizedCanvas = this.cloneCanvas(rawCanvas);
      this.binarize(binarizedCanvas);
    } finally {
      URL.revokeObjectURL(url);
    }

    const { createWorker, PSM } = await import('tesseract.js');
    const worker = await createWorker('eng', 1, {
      workerPath: 'assets/tesseract/worker.min.js',
      langPath: 'assets/tessdata',
      corePath: 'assets/tesseract',
      gzip: true,
    });
    
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });

    try {
      // Pass 1: full binarized image. We do this first to find the dynamic anchor!
      const fullBinarizedResult = await this.recognize(worker, binarizedCanvas, PSM.SINGLE_BLOCK);
      const fullBinarizedText = fullBinarizedResult.text;

      // Find dynamic anchor
      let activityYRatio = 0.60; // fallback for 16:9 phones
      const lines = fullBinarizedResult.data.lines || [];
      const anchorLine = lines.find((l: any) => /TOTAL ACTIVITY|DISTANCE WALKED/i.test(l.text));
      if (anchorLine) {
        // Start crop slightly above the anchor text
        activityYRatio = Math.max(0, (anchorLine.bbox.y0 - 20) / rawCanvas.height);
      } else {
        const fallbackLine = lines.find((l: any) => /CAUGHT/i.test(l.text));
        if (fallbackLine) {
          activityYRatio = Math.max(0, (fallbackLine.bbox.y0 - 60) / rawCanvas.height);
        }
      }

      // Generate focused crops using dynamic ratio
      const headerCanvas = this.cropCanvas(rawCanvas, 0, 0.08, 1, 0.54);
      this.binarize(headerCanvas);

      const activityCanvas = this.cropCanvas(rawCanvas, 0, activityYRatio, 1, 1 - activityYRatio);
      this.binarize(activityCanvas);

      const activityValuesCanvas = this.cropCanvas(rawCanvas, 0.50, activityYRatio, 0.45, 1 - activityYRatio);
      this.binarize(activityValuesCanvas);

      // Pass 2: Focused crops
      const headerText = (await this.recognize(worker, headerCanvas, PSM.SINGLE_BLOCK)).text;
      const activityText = (await this.recognize(worker, activityCanvas, PSM.SINGLE_BLOCK)).text;
      const activityValuesText = (await this.recognize(worker, activityValuesCanvas, PSM.SINGLE_BLOCK, '0123456789.,/ kmiKM')).text;
      
      const orderedActivityText = this.buildActivityTextFromOrderedValues(activityValuesText);
      const focusedText = [headerText, activityText, orderedActivityText].filter(Boolean).join('\n');
      const stats1 = parseProfileStats(focusedText);

      // We already have fullBinarizedText from Pass 1
      const stats2 = parseProfileStats([focusedText, fullBinarizedText].join('\n'));

      // Pass 3: Original raw image
      const rawTextResult = await this.recognize(worker, rawCanvas, PSM.SINGLE_BLOCK);
      const rawText = rawTextResult.text;
      const stats3 = parseProfileStats(rawText);

      const mergedStats = this.mergeStats(this.mergeStats(stats1, stats2), stats3);

      if (!mergedStats) {
        throw new ProfileOcrParseError(
          'Could not read all stats from the screenshot. Try a clearer image with Total Activity visible.',
          [focusedText, fullBinarizedText, rawText].join('\n'),
        );
      }

      return { stats: mergedStats, rawText: [focusedText, fullBinarizedText, rawText].join('\n') };
    } finally {
      await worker.terminate();
    }
  }

  private mergeStats(
    primary: ProfileStats | null,
    secondary: ProfileStats | null,
  ): ProfileStats | null {
    if (!primary && !secondary) return null;
    if (!primary) return secondary;
    if (!secondary) return primary;
    return {
      ...primary,
      level: primary.level ?? secondary.level,
      distanceWalked: primary.distanceWalked ?? secondary.distanceWalked,
      distanceUnit: primary.distanceUnit ?? secondary.distanceUnit,
      pokemonCaught: primary.pokemonCaught ?? secondary.pokemonCaught,
      pokestopsVisited: primary.pokestopsVisited ?? secondary.pokestopsVisited,
      totalXp: Math.max(primary.totalXp ?? 0, secondary.totalXp ?? 0) || null,
      username: (primary.username && secondary.username)
        ? (primary.username.length >= secondary.username.length ? primary.username : secondary.username)
        : (primary.username ?? secondary.username),
    };
  }

  private loadImage(file: File): Promise<{ img: HTMLImageElement; url: string }> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        resolve({ img, url });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image.'));
      };
      img.src = url;
    });
  }

  private scaleImage(img: HTMLImageElement): Promise<HTMLCanvasElement> {
    const imgWidth = img.naturalWidth || img.width;
    const imgHeight = img.naturalHeight || img.height;
    const scale = imgWidth > MAX_IMAGE_WIDTH ? MAX_IMAGE_WIDTH / imgWidth : 1;
    const width = Math.round(imgWidth * scale);
    const height = Math.round(imgHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return Promise.reject(new Error('Could not prepare image for OCR.'));
    }

    ctx.drawImage(img, 0, 0, width, height);
    return Promise.resolve(canvas);
  }

  private cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
    const clone = document.createElement('canvas');
    clone.width = source.width;
    clone.height = source.height;
    const ctx = clone.getContext('2d');
    ctx?.drawImage(source, 0, 0);
    return clone;
  }

  private cropCanvas(
    source: HTMLCanvasElement,
    xRatio: number,
    yRatio: number,
    widthRatio: number,
    heightRatio: number,
  ): HTMLCanvasElement {
    const sx = Math.round(source.width * xRatio);
    const sy = Math.round(source.height * yRatio);
    const sw = Math.round(source.width * widthRatio);
    const sh = Math.round(source.height * heightRatio);
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas;
  }

  private binarize(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      if (typeof cv === 'undefined' || !cv.Mat) {
        throw new Error('OpenCV not loaded yet');
      }
      const src = cv.imread(canvas);
      const dst = new cv.Mat();
      // Convert to grayscale
      cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
      // Adaptive thresholding: block size 51 and C 10 prevents hollowing out bold text
      cv.adaptiveThreshold(dst, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 51, 10);
      cv.imshow(canvas, dst);
      src.delete();
      dst.delete();
    } catch (e) {
      console.warn('OpenCV binarize failed, using fallback:', e);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const v = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = v; data[i + 1] = v; data[i + 2] = v;
      }
      ctx.putImageData(imageData, 0, 0);
    }
  }

  private async recognize(
    worker: any,
    canvas: HTMLCanvasElement,
    pageSegMode: unknown,
    whitelist?: string,
  ): Promise<{ text: string; data: any }> {
    await worker.setParameters({
      tessedit_pageseg_mode: pageSegMode,
      tessedit_char_whitelist: whitelist ?? '',
    });
    const { data } = await worker.recognize(canvas);
    return { text: data.text ?? '', data };
  }

  private buildActivityTextFromOrderedValues(text: string): string {
    const lines = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !/\d\s*\/\s*\d/.test(line));

    const distanceIndex = lines.findIndex(line => /\d/.test(line) && /(?:km|mi)/i.test(line));
    const distance = distanceIndex >= 0 ? lines[distanceIndex] : null;
    const activityLines = distanceIndex >= 0 ? lines.slice(distanceIndex + 1) : lines;

    const integerTexts = activityLines
      .flatMap(line => [...line.matchAll(/[\d,.]+/g)].map(match => match[0]))
      .filter(value => !value.includes('/') && !/\d+\.\d{2,}$/.test(value));

    const rows: string[] = [];
    if (distance) {
      rows.push(`Distance Walked ${distance}`);
    }

    const integerValues = integerTexts.map(value => ({
      text: value,
      value: parseInt(value.replace(/[,.]/g, ''), 10),
    })).filter(({ value }) => !Number.isNaN(value) && value >= 0);

    if (integerValues.length >= 3) {
      rows.push(`Pokemon Caught ${integerValues[0].text}`);
      rows.push(`Pokestops Visited ${integerValues[1].text}`);
      rows.push(`Total XP: ${integerValues[2].text}`);
    } else {
      const activityCounts = integerValues.filter(({ value }) => value < 1_000_000);
      const totalXp = integerValues.find(({ value }) => value >= 1_000_000) || integerValues[2];

      if (activityCounts[0]) rows.push(`Pokemon Caught ${activityCounts[0].text}`);
      if (activityCounts[1]) rows.push(`Pokestops Visited ${activityCounts[1].text}`);
      if (totalXp) rows.push(`Total XP: ${totalXp.text}`);
    }

    return rows.join('\n');
  }
}

export class ProfileOcrParseError extends Error {
  constructor(
    message: string,
    readonly rawText: string
  ) {
    super(message);
    this.name = 'ProfileOcrParseError';
  }
}
