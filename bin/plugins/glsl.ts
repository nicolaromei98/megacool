// bun-plugin-glsl.ts

import fs from "fs";
import path from "path";
import type { BunPlugin, OnLoadArgs } from "bun";

interface GLSLPluginOptions {
  include?: RegExp;
  warnDuplicatedImports?: boolean;
  removeDuplicatedImports?: boolean;
  defaultExtension?: string;
  compress?: boolean;
}

function loadShaderContent(
  source: string,
  filePath: string,
  options: Required<GLSLPluginOptions>,
  allFiles: Set<string> = new Set()
): string {
  const {
    warnDuplicatedImports,
    removeDuplicatedImports,
    defaultExtension,
    compress,
  } = options;

  if (allFiles.has(filePath)) {
    if (warnDuplicatedImports) {
      console.warn(
        `[vite-plugin-glsl] '${filePath}' was included multiple times.`
      );
    }
    if (removeDuplicatedImports) {
      return ""; // skip this chunk if duplicates are removed
    }
  }
  allFiles.add(filePath);

  let cleanedSource = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");

  const includePattern = /#include\s+["'<](.*)["'>]/g;

  cleanedSource = cleanedSource.replace(
    includePattern,
    (_, includePath: string) => {
      const baseDir = path.dirname(filePath);
      let resolved = path.join(baseDir, includePath);

      if (!path.extname(resolved)) {
        resolved += `.${defaultExtension}`;
      }

      if (!fs.existsSync(resolved)) {
        throw new Error(
          `[vite-plugin-glsl for Bun] Cannot find include: ${resolved}`
        );
      }

      const chunkContent = fs.readFileSync(resolved, "utf8");
      return loadShaderContent(chunkContent, resolved, options, allFiles);
    }
  );

  if (compress) {
    return cleanedSource
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join("\n");
  }

  return cleanedSource;
}

/**
 * Bun plugin for processing GLSL-like shader files.
 *
 * Usage (in a bun config or from CLI):
 *   bun build index.ts --plugins ./bun-plugin-glsl.ts
 */
export function glslPlugin(opts: GLSLPluginOptions = {}): BunPlugin {
  const options: Required<GLSLPluginOptions> = {
    include: /\.(?:glsl|wgsl|vert|frag|vs|fs)$/,
    warnDuplicatedImports: true,
    removeDuplicatedImports: false,
    defaultExtension: "glsl",
    compress: false,
    ...opts,
  };

  return {
    name: "bun-plugin-glsl",
    setup(build) {
      build.onLoad({ filter: options.include }, async (args: OnLoadArgs) => {
        const source = fs.readFileSync(args.path, "utf8");
        const outputShader = loadShaderContent(source, args.path, options);

        return {
          contents: outputShader,
          loader: "text",
        };
      });
    },
  };
}
