import "server-only";
import { createProvider } from "./provider";
import { createExtractionHandler } from "./handler";

export const extractRoleHandler = createExtractionHandler((text, signal) => createProvider({ apiKey: process.env.OPENAI_API_KEY ?? "", model: process.env.OPENAI_MODEL ?? "" })(text, signal));
