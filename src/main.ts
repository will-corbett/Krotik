import { mount } from 'svelte';
import '@fontsource/pt-serif/400.css';
import '@fontsource/pt-serif/700.css';
import '@fontsource/pt-sans/400.css';
import '@fontsource/pt-sans/700.css';
import './styles/app.css';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
