import { generateSandbox } from "./generate";

/** One deterministic sandbox for the whole page, so the server prerender and the browser agree. */
export const sandbox = generateSandbox();
