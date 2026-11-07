/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { parse } from 'yaml';
import { SITE_BASE } from './src/shared/site.ts';

/** Import .yaml files as data, parsed at build time (content/culture/*.yaml). The `yaml` package is already a
 *  dev dependency of the data pipeline, so nothing ships to the browser but the parsed JSON. */
const yamlData = {
  name: 'yaml-data',
  transform(src: string, id: string) {
    if (!/\.ya?ml$/.test(id)) return null;
    return { code: `export default ${JSON.stringify(parse(src))};`, map: null };
  },
};

// Pages have real addresses under SITE_BASE (prerendered by scripts/prerender.ts), so the base is absolute.
export default defineConfig({
  base: SITE_BASE,
  plugins: [yamlData, svelte()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
