import * as fs from "node:fs";
import type { QRData, QrexOptions } from "../types/qrex.type";
import { RendererSvgTag } from "./svg-tag";

export class RendererSvg {
  private rendererSvgTag = new RendererSvgTag();

  public render(qrData: QRData, options?: QrexOptions): string {
    return this.rendererSvgTag.render(qrData, options);
  }

  public renderToFile(path: string, qrData: QRData, options?: QrexOptions): void {
    const svgTag = this.render(qrData, options);

    const xmlStr = `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">${svgTag}`;

    fs.writeFileSync(path, xmlStr);
  }
}
