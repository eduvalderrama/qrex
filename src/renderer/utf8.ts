import * as fs from "node:fs";
import type { QRData, QrexOptions } from "../types/qrex.type";
import { RendererUtils } from "./utils";

export class RendererUtf8 {
  private BLOCK_CHAR = {
    WW: " ",
    WB: "▄",
    BB: "█",
    BW: "▀",
  };

  private INVERTED_BLOCK_CHAR = {
    BB: " ",
    BW: "▄",
    WW: "█",
    WB: "▀",
  };

  private getBlockChar(top: number, bottom: number, blocks): string {
    if (top && bottom) return blocks.BB;
    if (top && !bottom) return blocks.BW;
    if (!top && bottom) return blocks.WB;
    return blocks.WW;
  }

  public render(qrData: QRData, options?: QrexOptions) {
    const opts = RendererUtils.getOptions(options);
    let blocks = this.BLOCK_CHAR;
    if (opts.color.dark.hex === "#ffffff" || opts.color.light.hex === "#000000") {
      blocks = this.INVERTED_BLOCK_CHAR;
    }

    const size = qrData.modules.size;
    const data = qrData.modules.data;

    let output = "";
    let hMargin = Array(size + opts.margin * 2 + 1).join(blocks.WW);
    hMargin = Array(opts.margin / 2 + 1).join(`${hMargin}
`);

    const vMargin = Array(opts.margin + 1).join(blocks.WW);

    output += hMargin;
    for (let i = 0; i < size; i += 2) {
      output += vMargin;
      for (let j = 0; j < size; j++) {
        const topModule = data[i * size + j];
        const bottomModule = data[(i + 1) * size + j];

        output += this.getBlockChar(topModule, bottomModule, blocks);
      }

      output += `${vMargin}
`;
    }

    output += hMargin.slice(0, -1);

    return output;
  }

  public renderToFile(path: string, qrData: QRData, options?: QrexOptions): void {
    const utf8 = this.render(qrData, options);
    fs.writeFileSync(path, utf8);
  }
}
