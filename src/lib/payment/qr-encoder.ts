// ─────────────────────────────────────────────────────────────────────────────
// QR Code generator — ZERO dependencies. Adapted from Nayuki's public-domain
// reference (MIT/public domain). Trimmed to byte-mode + auto version + ECC.
//
// Why this exists: QRIS dynamic payloads come back as raw EMVCo strings
// (`qr_string`). To let a cashier's customer SCAN, we must render that string
// as an actual QR image. We do it in-house so the app never depends on an
// external lib like `qrcode.react` being installed.
//
// Usage:
//   const matrix = encodeQr(qrString, "M");  // boolean[][]
//   → render each true cell as a dark square (see qris-dialog QrCanvas).
// ─────────────────────────────────────────────────────────────────────────────

export type EccLevel = "L" | "M" | "Q" | "H";

const ECC_INDEX: Record<EccLevel, number> = { L: 0, M: 1, Q: 2, H: 3 };

const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

function getNumRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}
function getNumDataCodewords(ver: number, eccIdx: number): number {
  return (
    Math.floor(getNumRawDataModules(ver) / 8) -
    ECC_CODEWORDS_PER_BLOCK[eccIdx][ver] * NUM_ERROR_CORRECTION_BLOCKS[eccIdx][ver]
  );
}

function rsMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function rsComputeDivisor(degree: number): Uint8Array {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = rsMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = rsMultiply(root, 0x02);
  }
  return result;
}
function rsComputeRemainder(data: Uint8Array, divisor: Uint8Array): Uint8Array {
  const result = new Uint8Array(divisor.length);
  for (const b of data) {
    const factor = b ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let i = 0; i < result.length; i++) result[i] ^= rsMultiply(divisor[i], factor);
  }
  return result;
}

/** Encode a string in byte mode → boolean module matrix (true = dark). */
export function encodeQr(data: string, ecc: EccLevel = "M"): boolean[][] {
  const eccIdx = ECC_INDEX[ecc];
  const bytes = new TextEncoder().encode(data);

  let version = -1;
  for (let v = 1; v <= 40; v++) {
    const cap = getNumDataCodewords(v, eccIdx) * 8;
    const ccBits = v <= 9 ? 8 : 16;
    const needed = 4 + ccBits + bytes.length * 8;
    if (needed <= cap) {
      version = v;
      break;
    }
  }
  if (version === -1) throw new Error("Data terlalu panjang untuk QR (maks versi 40).");

  // bit buffer
  const bb: number[] = [];
  const append = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1);
  };
  append(0x4, 4); // byte mode
  const ccBits = version <= 9 ? 8 : 16;
  append(bytes.length, ccBits);
  for (const b of bytes) append(b, 8);

  const dataCapacity = getNumDataCodewords(version, eccIdx) * 8;
  for (let i = 0; i < 4 && bb.length < dataCapacity; i++) bb.push(0);
  while (bb.length % 8 !== 0) bb.push(0);
  const padBytes = [0xec, 0x11];
  for (let i = 0; bb.length < dataCapacity; i++) {
    const pb = padBytes[i % 2];
    for (let k = 7; k >= 0; k--) bb.push((pb >>> k) & 1);
  }

  const dataCodewords = new Uint8Array(bb.length / 8);
  for (let i = 0; i < bb.length; i++) dataCodewords[i >>> 3] |= bb[i] << (7 - (i & 7));

  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[eccIdx][version];
  const eccLen = ECC_CODEWORDS_PER_BLOCK[eccIdx][version];
  const rawCodewords = Math.floor(getNumRawDataModules(version) / 8);
  const numShort = numBlocks - (rawCodewords % numBlocks);
  const shortLen = Math.floor(rawCodewords / numBlocks);

  const divisor = rsComputeDivisor(eccLen);
  const blocks: { dat: Uint8Array; ecc: Uint8Array; datLen: number }[] = [];
  let k = 0;
  for (let i = 0; i < numBlocks; i++) {
    const datLen = shortLen - eccLen + (i < numShort ? 0 : 1);
    const dat = dataCodewords.slice(k, k + datLen);
    k += datLen;
    const eccBytes = rsComputeRemainder(dat, divisor);
    blocks.push({ dat, ecc: eccBytes, datLen });
  }

  const interleaved: number[] = [];
  const maxDat = shortLen - eccLen + 1;
  for (let i = 0; i < maxDat; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i < blocks[b].datLen) interleaved.push(blocks[b].dat[i]);
    }
  }
  for (let i = 0; i < eccLen; i++) {
    for (let b = 0; b < numBlocks; b++) interleaved.push(blocks[b].ecc[i]);
  }
  const allCodewords = Uint8Array.from(interleaved);

  return drawMatrix(version, eccIdx, allCodewords);
}

function drawMatrix(version: number, eccIdx: number, allCodewords: Uint8Array): boolean[][] {
  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

  const setFunc = (x: number, y: number, val: boolean) => {
    modules[y][x] = val;
    isFunction[y][x] = true;
  };

  const drawFinder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const xx = cx + dx, yy = cy + dy;
        if (xx < 0 || xx >= size || yy < 0 || yy >= size) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        setFunc(xx, yy, dist !== 2 && dist !== 4);
      }
  };
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  for (let i = 0; i < size; i++) {
    if (!isFunction[6][i]) setFunc(i, 6, i % 2 === 0);
    if (!isFunction[i][6]) setFunc(6, i, i % 2 === 0);
  }

  setFunc(8, size - 8, true);

  const alignPos = getAlignmentPositions(version, size);
  for (let i = 0; i < alignPos.length; i++) {
    for (let j = 0; j < alignPos.length; j++) {
      const ax = alignPos[i], ay = alignPos[j];
      if ((ax <= 7 && ay <= 7) || (ax <= 7 && ay >= size - 8) || (ax >= size - 8 && ay <= 7)) continue;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          setFunc(ax + dx, ay + dy, dist !== 1);
        }
    }
  }

  // reserve format/version areas
  for (let i = 0; i <= 5; i++) isFunction[8][i] = true;
  isFunction[8][7] = true;
  isFunction[8][8] = true;
  isFunction[7][8] = true;
  for (let i = 0; i <= 6; i++) isFunction[i][8] = true;
  for (let i = 0; i < 8; i++) {
    isFunction[8][size - 1 - i] = true;
    isFunction[size - 1 - i][8] = true;
  }
  if (version >= 7) {
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 3; j++) {
        isFunction[size - 11 + j][i] = true;
        isFunction[i][size - 11 + j] = true;
      }
  }

  // place data (zigzag)
  let idx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && idx < allCodewords.length * 8) {
          modules[y][x] = ((allCodewords[idx >>> 3] >>> (7 - (idx & 7))) & 1) !== 0;
          idx++;
        }
      }
    }
  }

  // choose best mask
  let bestPenalty = Infinity;
  let bestModules: boolean[][] = modules;
  for (let mask = 0; mask < 8; mask++) {
    const test = modules.map((r) => r.slice());
    applyMask(test, isFunction, mask, size);
    drawFormatBits(test, eccIdx, mask, size);
    if (version >= 7) drawVersionBits(test, version, size);
    const pen = penalty(test, size);
    if (pen < bestPenalty) {
      bestPenalty = pen;
      bestModules = test;
    }
  }
  return bestModules;
}

function getAlignmentPositions(ver: number, size: number): number[] {
  if (ver === 1) return [];
  const num = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (num * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < num; pos -= step) result.splice(1, 0, pos);
  return result;
}

function applyMask(modules: boolean[][], isFunction: boolean[][], mask: number, size: number) {
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (isFunction[y][x]) continue;
      let invert = false;
      switch (mask) {
        case 0: invert = (x + y) % 2 === 0; break;
        case 1: invert = y % 2 === 0; break;
        case 2: invert = x % 3 === 0; break;
        case 3: invert = (x + y) % 3 === 0; break;
        case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
        case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        case 7: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
      }
      if (invert) modules[y][x] = !modules[y][x];
    }
}

function drawFormatBits(modules: boolean[][], eccIdx: number, mask: number, size: number) {
  const eccFormatBits = [1, 0, 3, 2][eccIdx];
  const data = (eccFormatBits << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const get = (i: number) => ((bits >>> i) & 1) !== 0;

  for (let i = 0; i <= 5; i++) modules[8][i] = get(i);
  modules[8][7] = get(6);
  modules[8][8] = get(7);
  modules[7][8] = get(8);
  for (let i = 9; i < 15; i++) modules[14 - i][8] = get(i);

  for (let i = 0; i < 8; i++) modules[8][size - 1 - i] = get(i);
  for (let i = 8; i < 15; i++) modules[size - 15 + i][8] = get(i);
  modules[size - 8][8] = true;
}

function drawVersionBits(modules: boolean[][], version: number, size: number) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (version << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const bit = ((bits >>> i) & 1) !== 0;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    modules[a][b] = bit;
    modules[b][a] = bit;
  }
}

function penalty(modules: boolean[][], size: number): number {
  let p = 0;
  for (let y = 0; y < size; y++) {
    let run = 1;
    for (let x = 1; x < size; x++) {
      if (modules[y][x] === modules[y][x - 1]) {
        run++;
        if (run === 5) p += 3;
        else if (run > 5) p++;
      } else run = 1;
    }
  }
  for (let x = 0; x < size; x++) {
    let run = 1;
    for (let y = 1; y < size; y++) {
      if (modules[y][x] === modules[y - 1][x]) {
        run++;
        if (run === 5) p += 3;
        else if (run > 5) p++;
      } else run = 1;
    }
  }
  for (let y = 0; y < size - 1; y++)
    for (let x = 0; x < size - 1; x++) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) p += 3;
    }
  let dark = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) dark++;
  const ratio = dark / (size * size);
  p += Math.floor(Math.abs(ratio * 100 - 50) / 5) * 10;
  return p;
}

/** Build an inline SVG string for a QR matrix. Crisp, no external deps. */
export function qrMatrixToSvg(
  matrix: boolean[][],
  opts: { size?: number; margin?: number; dark?: string; light?: string } = {}
): string {
  const n = matrix.length;
  const margin = opts.margin ?? 4;
  const dim = n + margin * 2;
  const px = opts.size ?? 256;
  const dark = opts.dark ?? "#000000";
  const light = opts.light ?? "#ffffff";

  let path = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (matrix[y][x]) {
        path += `M${x + margin},${y + margin}h1v1h-1z`;
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" ` +
    `viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">` +
    `<rect width="${dim}" height="${dim}" fill="${light}"/>` +
    `<path d="${path}" fill="${dark}"/>` +
    `</svg>`
  );
}
