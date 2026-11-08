import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedClientOrigin } from "../clientOrigins.js";

const productionOrigin = "https://bandw-the-men-salon.vercel.app";
const allowedOrigins = [productionOrigin];

test("allows the exact production frontend origin", () => {
  assert.equal(isAllowedClientOrigin(productionOrigin, allowedOrigins, true), true);
});

test("allows changing Vercel deployment and branch preview domains", () => {
  assert.equal(
    isAllowedClientOrigin(
      "https://bandw-the-men-salon-n2rjw69fc-blackandwhitemensalon-3373.vercel.app",
      allowedOrigins,
      true,
    ),
    true,
  );
  assert.equal(
    isAllowedClientOrigin(
      "https://bandw-the-men-salon-git-main-blackandwhitemensalon-3373.vercel.app",
      allowedOrigins,
      true,
    ),
    true,
  );
});

test("rejects unrelated hosts and non-HTTPS preview origins", () => {
  assert.equal(
    isAllowedClientOrigin("https://unrelated-project.vercel.app", allowedOrigins, true),
    false,
  );
  assert.equal(
    isAllowedClientOrigin(
      "http://bandw-the-men-salon-preview.vercel.app",
      allowedOrigins,
      true,
    ),
    false,
  );
});

test("allows requests without an Origin header and development origins", () => {
  assert.equal(isAllowedClientOrigin(undefined, allowedOrigins, true), true);
  assert.equal(
    isAllowedClientOrigin("http://localhost:5173", allowedOrigins, false),
    true,
  );
});
