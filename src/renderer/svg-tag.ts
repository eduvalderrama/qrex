import type { ColorObject, QRData, QrexOptions } from "../types/qrex.type";
import { RendererUtils } from "./utils";

export class RendererSvgTag {
  private getColorAttrib(color: ColorObject, attrib: string) {
    const alpha = color.a / 255;
    const str = `${attrib}="${color.hex}"`;

    return alpha < 1 ? `${str} ${attrib}-opacity="${alpha.toFixed(2).slice(1)}"` : str;
  }

  private svgCmd(cmd: string, x: number, y?: number) {
    let str = cmd + x;
    if (typeof y !== "undefined") str += ` ${y}`;

    return str;
  }

  private qrToPath(data: Uint8Array, size: number, margin: number) {
    let path = "";
    let moveBy = 0;
    let newRow = false;
    let lineLength = 0;

    for (let i = 0; i < data.length; i++) {
      const col = Math.floor(i % size);
      const row = Math.floor(i / size);

      if (!col && !newRow) newRow = true;

      if (data[i]) {
        lineLength++;

        if (!(i > 0 && col > 0 && data[i - 1])) {
          path += newRow ? this.svgCmd("M", col + margin, 0.5 + row + margin) : this.svgCmd("m", moveBy, 0);

          moveBy = 0;
          newRow = false;
        }

        if (!(col + 1 < size && data[i + 1])) {
          path += this.svgCmd("h", lineLength);
          lineLength = 0;
        }
      } else {
        moveBy++;
      }
    }

    return path;
  }

  public render(qrData: QRData, options?: QrexOptions) {
    const opts = RendererUtils.getOptions(options);
    const size = qrData.modules.size;
    const data = qrData.modules.data;
    const qrcodesize = size + opts.margin * 2;

    const bg = !opts.color.light.a
      ? ""
      : `<path ${this.getColorAttrib(opts.color.light, "fill")} d="M0 0h${qrcodesize}v${qrcodesize}H0z"/>`;

    const path = `<path ${this.getColorAttrib(opts.color.dark, "stroke")} d="${this.qrToPath(data, size, opts.margin)}"/>`;

    const viewBox = `viewBox="0 0 ${qrcodesize} ${qrcodesize}"`;

    const width = !opts.width ? "" : `width="${opts.width}" height="${opts.width}" `;

    return `<svg xmlns="http://www.w3.org/2000/svg" ${width}${viewBox} shape-rendering="crispEdges">${bg}${path}</svg>
`;
  }
}
