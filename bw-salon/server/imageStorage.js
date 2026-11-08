import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { imageTypeFromHeader } from "./imageUploads.js";

export function cloudinaryPublicIdFromUrl(source, cloudName) {
  let url;
  try {
    url = new URL(source);
  } catch {
    return null;
  }

  if (url.hostname !== "res.cloudinary.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== cloudName || parts[1] !== "image" || parts[2] !== "upload") {
    return null;
  }

  const publicIdParts = parts.slice(3);
  if (/^v\d+$/.test(publicIdParts[0] || "")) publicIdParts.shift();
  if (!publicIdParts.length) return null;

  const lastPart = publicIdParts.pop().replace(/\.[^.]+$/, "");
  if (!lastPart) return null;
  publicIdParts.push(lastPart);
  return publicIdParts.join("/");
}

export function createImageStore({
  cloudName,
  apiKey,
  apiSecret,
  uploadDir,
  requireCloudinary = false,
}) {
  const credentials = [cloudName, apiKey, apiSecret].map(value => value?.trim());
  const configuredCount = credentials.filter(Boolean).length;
  if (configuredCount > 0 && configuredCount < credentials.length) {
    throw new Error("Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET together.");
  }
  const useCloudinary = configuredCount === credentials.length;

  if (requireCloudinary && !useCloudinary) {
    throw new Error("Cloudinary credentials are required in production.");
  }

  if (useCloudinary) {
    cloudinary.config({
      cloud_name: credentials[0],
      api_key: credentials[1],
      api_secret: credentials[2],
      secure: true,
    });
  }

  const uploadToCloudinary = (buffer, folder) => new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `bw-salon/${folder}`, resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url) return reject(new Error("Cloudinary returned no secure image URL."));
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });

  return {
    isCloudinary: useCloudinary,
    async upload(file, folder) {
      const imageType = imageTypeFromHeader(file.buffer.subarray(0, 12));
      if (!imageType) {
        throw Object.assign(new Error("Uploaded file content is not a supported image."), { status: 400 });
      }

      file.mimetype = imageType.mimeType;
      if (useCloudinary) return uploadToCloudinary(file.buffer, folder);

      await fs.mkdir(uploadDir, { recursive: true });
      const filename = `${randomUUID()}${imageType.extension}`;
      await fs.writeFile(path.join(uploadDir, filename), file.buffer, { flag: "wx" });
      return `/uploads/${filename}`;
    },
    async remove(source) {
      if (source?.startsWith("/uploads/")) {
        const filename = path.basename(source);
        if (filename !== source.slice("/uploads/".length)) {
          throw new Error("Invalid local upload path.");
        }
        try {
          await fs.unlink(path.join(uploadDir, filename));
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
        return;
      }

      if (!useCloudinary) return;
      const publicId = cloudinaryPublicIdFromUrl(source, credentials[0]);
      if (!publicId) return;
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
        invalidate: true,
      });
      if (!["ok", "not found"].includes(result.result)) {
        throw new Error(`Cloudinary did not delete image ${publicId}.`);
      }
    },
  };
}
