import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { pluginGitHash } from "rsbuild-plugin-git-hash";

export default defineConfig({
  plugins: [pluginReact(), pluginGitHash()],
  server: {
    compress: true,
  },
});
