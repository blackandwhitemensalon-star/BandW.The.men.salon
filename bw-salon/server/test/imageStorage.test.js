import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { cloudinaryPublicIdFromUrl, createImageStore } from "../imageStorage.js";

test("requires complete Cloudinary credentials when any are configured", () => {
  assert.throws(
    () => createImageStore({
      cloudName: "salon",
      apiKey: "",
      apiSecret: "",
      uploadDir: "unused",
    }),
    /Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET together/,
  );
});

test("requires Cloudinary in production without creating a local uploads directory", () => {
  assert.throws(
    () => createImageStore({
      uploadDir: path.join(os.tmpdir(), "unused-salon-uploads"),
      requireCloudinary: true,
    }),
    /Cloudinary credentials are required in production/,
  );
});

test("stores and deletes locally when Cloudinary is not configured", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "salon-storage-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = createImageStore({ uploadDir: path.join(directory, "uploads") });
  const url = await store.upload({
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    mimetype: "image/png",
  }, "gallery");

  assert.match(url, /^\/uploads\/[a-f0-9-]+\.png$/);
  await fs.access(path.join(directory, "uploads", path.basename(url)));
  await store.remove(url);
  await assert.rejects(fs.access(path.join(directory, "uploads", path.basename(url))));
});

test("extracts only Cloudinary image IDs belonging to the configured cloud", () => {
  assert.equal(
    cloudinaryPublicIdFromUrl(
      "https://res.cloudinary.com/salon/image/upload/v123/bw-salon/gallery/photo.jpg",
      "salon",
    ),
    "bw-salon/gallery/photo",
  );
  assert.equal(
    cloudinaryPublicIdFromUrl("https://example.com/image.jpg", "salon"),
    null,
  );
  assert.equal(
    cloudinaryPublicIdFromUrl(
      "https://res.cloudinary.com/another/image/upload/v123/photo.jpg",
      "salon",
    ),
    null,
  );
});
