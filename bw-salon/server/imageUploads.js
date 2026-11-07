import fs from "node:fs/promises";
import path from "node:path";

const IMAGE_TYPES = [
  { extension: ".jpg", mimeType: "image/jpeg", matches: header =>
    header.length >= 3 &&
    header[0] === 0xff &&
    header[1] === 0xd8 &&
    header[2] === 0xff },
  { extension: ".png", mimeType: "image/png", matches: header =>
    header.length >= 8 &&
    header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { extension: ".gif", mimeType: "image/gif", matches: header =>
    header.length >= 6 &&
    ["GIF87a", "GIF89a"].includes(header.subarray(0, 6).toString("ascii")) },
  { extension: ".webp", mimeType: "image/webp", matches: header =>
    header.length >= 12 &&
    header.subarray(0, 4).toString("ascii") === "RIFF" &&
    header.subarray(8, 12).toString("ascii") === "WEBP" },
];

export const SUPPORTED_IMAGE_MIME_TYPES = IMAGE_TYPES.map(type => type.mimeType);
export const SUPPORTED_IMAGE_EXTENSIONS = IMAGE_TYPES.map(type => type.extension);

export function imageTypeFromHeader(header) {
  return IMAGE_TYPES.find(type => type.matches(header)) || null;
}

export async function normalizeUploadedImages(files) {
  for (const file of files) {
    const handle = await fs.open(file.path, "r");
    let header;
    try {
      header = Buffer.alloc(12);
      const { bytesRead } = await handle.read(header, 0, header.length, 0);
      header = header.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }

    const imageType = imageTypeFromHeader(header);
    if (!imageType) {
      throw Object.assign(
        new Error("Uploaded file content is not a supported image."),
        { status: 400 },
      );
    }

    const normalizedPath = `${file.path}${imageType.extension}`;
    await fs.rename(file.path, normalizedPath);
    file.path = normalizedPath;
    file.filename = path.basename(normalizedPath);
    file.mimetype = imageType.mimeType;
  }

  return files;
}
