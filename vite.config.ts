/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { parse } from 'yaml';

/** Import .yaml files as data, parsed at build time (content/culture/*.yaml). The `yaml` package is already a
 *  dev dependency of the data pipeline, so nothing ships to the browser but the parsed JSON. */
const yamlData = {
  name: 'yaml-data',
  transform(src: string, id: string) {
    if (!/\.ya?ml$/.test(id)) return null;
    return { code: `export default ${JSON.stringify(parse(src))};`, map: null };
  },
};

// Relative base so the built site works from any static host or sub-path.
export default defineConfig({
  base: './',
  plugins: [yamlData, svelte()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
