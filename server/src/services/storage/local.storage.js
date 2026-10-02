import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";

export class LocalStorageProvider {
  constructor(options = {}) {
    this.uploadDir = options.uploadDir || path.resolve(process.cwd(), "public/uploads");
    this.publicPathPrefix = options.publicPathPrefix || "/uploads";
  }

  async init() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (err) {
      console.error("Failed to create upload directory:", err);
    }
  }

  async save(file) {
    await this.init();

    // Generate safe, collision-resistant filename
    const ext = path.extname(file.originalname).toLowerCase();
    const hash = crypto.randomBytes(16).toString("hex");
    const filename = `${Date.now()}-${hash}${ext}`;
    const targetPath = path.join(this.uploadDir, filename);

    // Write file buffer to target path
    await fs.writeFile(targetPath, file.buffer);

    return {
      filename,
      url: `${this.publicPathPrefix}/${filename}`,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  async delete(filename) {
    try {
      const targetPath = path.join(this.uploadDir, filename);
      await fs.unlink(targetPath);
      return true;
    } catch {
      return false;
    }
  }
}
