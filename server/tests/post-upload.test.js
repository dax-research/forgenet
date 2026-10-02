import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import Post from "../src/features/posts/post.model.js";
import User from "../src/features/users/user.model.js";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { env } from "../src/config/env.js";

let server;
let baseUrl;
let token;
let userA;
let userB;
let tokenB;

const createAuthToken = (userId) =>
  jwt.sign({}, env.jwtSecret, {
    subject: userId.toString(),
    expiresIn: "1h",
  });

test.before(async () => {
  await connectDatabase();

  server = app.listen(0);
  const address = server.address();
  baseUrl = `http://localhost:${address.port}`;

  // Create test users
  const uniqueSuffix = Date.now();
  userA = await User.create({
    name: "Test User A",
    email: `test_a_${uniqueSuffix}@example.com`,
    password: "Password123!",
  });
  token = createAuthToken(userA._id);

  userB = await User.create({
    name: "Test User B",
    email: `test_b_${uniqueSuffix}@example.com`,
    password: "Password123!",
  });
  tokenB = createAuthToken(userB._id);
});

test.after(async () => {
  if (userA) await User.findByIdAndDelete(userA._id);
  if (userB) await User.findByIdAndDelete(userB._id);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDatabase();
});

test("1. Create text-only post (JSON)", async () => {
  const res = await fetch(`${baseUrl}/api/v1/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      content: "Hello ForgeNet! This is a valid text-only post.",
      tags: ["test", "forgenet"],
    }),
  });

  const data = await res.json();
  assert.equal(res.status, 201);
  assert.equal(data.success, true);
  assert.equal(data.data.post.content, "Hello ForgeNet! This is a valid text-only post.");
  assert.equal(data.data.post.author.toString(), userA._id.toString());
});

test("2. Create post with 1 valid image (multipart/form-data)", async () => {
  const form = new FormData();
  form.append("content", "Post with one image");
  const blob = new Blob(["fake-image-content-jpeg"], { type: "image/jpeg" });
  form.append("images", blob, "photo.jpg");

  const res = await fetch(`${baseUrl}/api/v1/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const data = await res.json();
  assert.equal(res.status, 201);
  assert.equal(data.success, true);
  assert.equal(data.data.post.media.length, 1);
  assert.equal(data.data.post.media[0].type, "image");
  assert.equal(data.data.post.media[0].mimeType, "image/jpeg");
  assert.equal(data.data.post.images.length, 1);
});

test("3. Create post with multiple valid images (multipart/form-data)", async () => {
  const form = new FormData();
  form.append("content", "Post with 3 images");
  form.append("images", new Blob(["png1"], { type: "image/png" }), "1.png");
  form.append("images", new Blob(["png2"], { type: "image/png" }), "2.png");
  form.append("images", new Blob(["webp1"], { type: "image/webp" }), "3.webp");

  const res = await fetch(`${baseUrl}/api/v1/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const data = await res.json();
  assert.equal(res.status, 201);
  assert.equal(data.success, true);
  assert.equal(data.data.post.media.length, 3);
});

test("4. Exactly 20 images -> accepted", async () => {
  const form = new FormData();
  form.append("content", "Post with 20 images");
  for (let i = 0; i < 20; i++) {
    form.append("images", new Blob([`img_${i}`], { type: "image/png" }), `img_${i}.png`);
  }

  const res = await fetch(`${baseUrl}/api/v1/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const data = await res.json();
  assert.equal(res.status, 201);
  assert.equal(data.success, true);
  assert.equal(data.data.post.media.length, 20);
});

test("5. 21 images -> reject with 400", async () => {
  const form = new FormData();
  form.append("content", "Post with 21 images");
  for (let i = 0; i < 21; i++) {
    form.append("images", new Blob([`img_${i}`], { type: "image/png" }), `img_${i}.png`);
  }

  const res = await fetch(`${baseUrl}/api/v1/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const data = await res.json();
  assert.equal(res.status, 400);
  assert.equal(data.success, false);
  assert.match(data.message, /Too many files|20 images/i);
});

test("6. Image exactly 5 MB -> accepted", async () => {
  const form = new FormData();
  form.append("content", "Post with 5MB image");
  // 5 * 1024 * 1024 bytes
  const largeBuffer = new Uint8Array(5 * 1024 * 1024);
  form.append("images", new Blob([largeBuffer], { type: "image/jpeg" }), "large.jpg");

  const res = await fetch(`${baseUrl}/api/v1/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const data = await res.json();
  assert.equal(res.status, 201);
  assert.equal(data.success, true);
  assert.equal(data.data.post.media[0].size, 5 * 1024 * 1024);
});

test("7. Image above 5 MB -> reject with 400", async () => {
  const form = new FormData();
  form.append("content", "Post with >5MB image");
  const tooLargeBuffer = new Uint8Array(5 * 1024 * 1024 + 1024);
  form.append("images", new Blob([tooLargeBuffer], { type: "image/jpeg" }), "too_large.jpg");

  const res = await fetch(`${baseUrl}/api/v1/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const data = await res.json();
  assert.equal(res.status, 400);
  assert.equal(data.success, false);
  assert.match(data.message, /File too large/i);
});

test("8. JPG -> accepted", async () => {
  const form = new FormData();
  form.append("content", "JPG check");
  form.append("images", new Blob(["jpg-content"], { type: "image/jpeg" }), "photo.jpg");

  const res = await fetch(`${baseUrl}/api/v1/posts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  assert.equal(res.status, 201);
});

test("9. PNG -> accepted", async () => {
  const form = new FormData();
  form.append("content", "PNG check");
  form.append("images", new Blob(["png-content"], { type: "image/png" }), "photo.png");

  const res = await fetch(`${baseUrl}/api/v1/posts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  assert.equal(res.status, 201);
});

test("10. WEBP -> accepted", async () => {
  const form = new FormData();
  form.append("content", "WEBP check");
  form.append("images", new Blob(["webp-content"], { type: "image/webp" }), "photo.webp");

  const res = await fetch(`${baseUrl}/api/v1/posts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  assert.equal(res.status, 201);
});

test("11. Unsupported file type (PDF/text) -> reject with 400", async () => {
  const form = new FormData();
  form.append("content", "Unsupported format check");
  form.append("images", new Blob(["pdf content"], { type: "application/pdf" }), "document.pdf");

  const res = await fetch(`${baseUrl}/api/v1/posts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = await res.json();
  assert.equal(res.status, 400);
  assert.equal(data.success, false);
  assert.match(data.message, /Unsupported file type/i);
});

test("12. Text exactly 3000 characters -> accepted", async () => {
  const exactContent = "a".repeat(3000);
  const res = await fetch(`${baseUrl}/api/v1/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content: exactContent }),
  });

  const data = await res.json();
  assert.equal(res.status, 201);
  assert.equal(data.success, true);
  assert.equal(data.data.post.content.length, 3000);
});

test("13. Text over 3000 characters -> reject with 400", async () => {
  const overContent = "a".repeat(3001);
  const res = await fetch(`${baseUrl}/api/v1/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content: overContent }),
  });

  const data = await res.json();
  assert.equal(res.status, 400);
  assert.equal(data.success, false);
  assert.match(data.message, /3000 characters/i);
});

test("14. Edit post with valid content -> accepted", async () => {
  // First create a post
  const createRes = await fetch(`${baseUrl}/api/v1/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content: "Initial content" }),
  });
  const createData = await createRes.json();
  const postId = createData.data.post._id;

  // Now update it
  const updateRes = await fetch(`${baseUrl}/api/v1/posts/${postId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content: "Updated valid content" }),
  });
  const updateData = await updateRes.json();
  assert.equal(updateRes.status, 200);
  assert.equal(updateData.success, true);
  assert.equal(updateData.data.post.content, "Updated valid content");
});

test("15. Edit post over 3000 characters -> reject with 400", async () => {
  // First create a post
  const createRes = await fetch(`${baseUrl}/api/v1/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content: "Initial content" }),
  });
  const createData = await createRes.json();
  const postId = createData.data.post._id;

  // Now update with >3000 chars
  const updateRes = await fetch(`${baseUrl}/api/v1/posts/${postId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content: "b".repeat(3001) }),
  });
  const updateData = await updateRes.json();
  assert.equal(updateRes.status, 400);
  assert.equal(updateData.success, false);
  assert.match(updateData.message, /3000 characters/i);
});

test("16. Unauthenticated upload -> reject with 401", async () => {
  const form = new FormData();
  form.append("content", "Unauthorized post");
  form.append("images", new Blob(["content"], { type: "image/png" }), "img.png");

  const res = await fetch(`${baseUrl}/api/v1/posts`, {
    method: "POST",
    body: form,
  });

  const data = await res.json();
  assert.equal(res.status, 401);
  assert.equal(data.success, false);
});

test("17. Unauthorized post modification -> reject with 403", async () => {
  // User A creates post
  const createRes = await fetch(`${baseUrl}/api/v1/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content: "User A post" }),
  });
  const createData = await createRes.json();
  const postId = createData.data.post._id;

  // User B tries to update User A's post
  const updateRes = await fetch(`${baseUrl}/api/v1/posts/${postId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenB}`,
    },
    body: JSON.stringify({ content: "User B tampering" }),
  });
  assert.equal(updateRes.status, 403);
});

test("18. Existing text-only posts still load", async () => {
  const res = await fetch(`${baseUrl}/api/v1/posts`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.data.posts));
});
