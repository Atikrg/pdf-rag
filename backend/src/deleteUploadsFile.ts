import fs from "fs/promises";
import path from "path";

async function clearUploadsFolder() {
  try {
    const uploadsPath = path.join(process.cwd(), "uploads");

    const files = await fs.readdir(uploadsPath);

    if (files.length === 0) {
      return;
    }

    await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(uploadsPath, file);
        await fs.unlink(filePath);
      })
    );

  } catch (error) {
    console.error("Error deleting files:", error);
  }
}

clearUploadsFolder();