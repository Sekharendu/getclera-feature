import "server-only";
import { createProvider } from "./provider";
import { createExtractionHandler } from "./handler";

export const extractRoleHandler = createExtractionHandler((text, signal) => createProvider({ apiKey: process.env.GEMINI_API_KEY ?? "", model: process.env.GEMINI_MODEL ?? "" })(text, signal));
