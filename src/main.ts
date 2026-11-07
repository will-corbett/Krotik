import { mount } from 'svelte';
import '@fontsource/pt-serif/400.css';
import '@fontsource/pt-serif/700.css';
import '@fontsource/pt-sans/400.css';
import '@fontsource/pt-sans/700.css';
import './styles/app.css';
import App from './App.svelte';

// Each page's HTML file carries a plain copy of its content (scripts/prerender.ts) for search engines and for
// anyone without JavaScript; the app replaces it.
const target = document.getElementById('app')!;
target.replaceChildren();
mount(App, { target });
