import { readdirSync, existsSync } from "fs";
import { join } from "path";

export function getPageFiles(): string[] {
  const pagesDir = join(process.cwd(), "src", "pages");

  // First check if the directory exists
  if (!existsSync(pagesDir)) {
    console.warn("Warning: No pages directory found at src/pages");
    return [];
  }

  try {
    const files = readdirSync(pagesDir);
    // Filter out any non-js/ts files and remove the extension
    return files.filter(
      (file) =>
        file.endsWith(".js") || file.endsWith(".ts") || file.endsWith(".css")
    );
  } catch (error) {
    console.error("Error reading pages directory:", error);
    return [];
  }
}
