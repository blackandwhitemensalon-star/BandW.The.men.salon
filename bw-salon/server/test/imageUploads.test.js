import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { imageTypeFromHeader, normalizeUploadedImages } from "../imageUploads.js";

const headers = [
  [".jpg", [0xff, 0xd8, 0xff, 0xe0]],
  [".png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  [".gif", [...Buffer.from("GIF89a")]],
  [".webp", [...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]],
];

test("recognizes supported raster image signatures", () => {
  for (const [extension, header] of headers) {
    assert.equal(imageTypeFromHeader(Buffer.from(header)).extension, extension);
  }
});

test("rejects HTML content even when the upload claims to be an image", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "salon-image-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "untrusted-upload");
  await fs.writeFile(filePath, "<script>alert(1)</script>");

  await assert.rejects(
    normalizeUploadedImages([{
      path: filePath,
      filename: "untrusted-upload",
      mimetype: "image/png",
    }]),
    error => error.status === 400,
  );
  await assert.rejects(fs.access(filePath + ".png"));
});

test("normalizes the served file extension from image content", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "salon-image-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "untrusted-upload.html");
  await fs.writeFile(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  const [file] = await normalizeUploadedImages([{
    path: filePath,
    filename: "untrusted-upload.html",
    mimetype: "image/png",
  }]);

  assert.equal(file.path, filePath + ".png");
  assert.equal(file.filename, "untrusted-upload.html.png");
  assert.equal(file.mimetype, "image/png");
});
