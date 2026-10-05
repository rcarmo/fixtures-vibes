// Resolve vendored Piclaw imports to Classic modules in tests as the build does (scripts/piclaw-editor-adapter.mjs).
import { plugin } from 'bun';
import { piclawEditorAdapter } from '../../scripts/piclaw-editor-adapter.mjs';

plugin(piclawEditorAdapter(new URL('../..', import.meta.url).pathname.replace(/\/$/, '')));
