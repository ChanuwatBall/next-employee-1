import { registerPlugin } from "@capacitor/core";

export interface PrintImageOptions {
  address: string;
  base64: string;

  /**
   * 58 mm usually uses 384 dots.
   * 80 mm usually uses 576 dots.
   */
  width?: number;

  /**
   * 0-255.
   * Higher = darker image.
   */
  threshold?: number;
}

export interface ThermalPrinterPlugin {
  printImage(options: PrintImageOptions): Promise<void>;
}

export const ThermalPrinter =
  registerPlugin<ThermalPrinterPlugin>(
    "ThermalPrinter",
  );