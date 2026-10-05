// Resolve vendored Piclaw imports to Classic modules in tests as the build does (scripts/piclaw-web.mjs).
import { plugin } from 'bun';
import { piclawWebAdapter } from '../../scripts/piclaw-web.mjs';

plugin(piclawWebAdapter(new URL('../..', import.meta.url).pathname.replace(/\/$/, '')));
