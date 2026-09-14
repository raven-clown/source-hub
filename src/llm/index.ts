import { env } from "../config/env.js";
import { AnthropicProvider } from "./anthropicProvider.js";
import { OpenAiCompatibleProvider } from "./openaiCompatibleProvider.js";
import type { LlmProvider } from "./types.js";

export type { LlmProvider, ToolSpec, JsonSchema } from "./types.js";

let cached: LlmProvider | undefined;

export function getLlmProvider(): LlmProvider {
  if (cached) return cached;

  if (env.LLM_PROVIDER === "openai_compatible") {
    if (!env.OPENAI_COMPATIBLE_BASE_URL || !env.OPENAI_COMPATIBLE_MODEL) {
      throw new Error(
        "LLM_PROVIDER=openai_compatible requires OPENAI_COMPATIBLE_BASE_URL and OPENAI_COMPATIBLE_MODEL"
      );
    }
    cached = new OpenAiCompatibleProvider({
      apiKey: env.OPENAI_COMPATIBLE_API_KEY ?? "not-needed",
      baseURL: env.OPENAI_COMPATIBLE_BASE_URL,
      model: env.OPENAI_COMPATIBLE_MODEL,
    });
    return cached;
  }

  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY");
  }
  cached = new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.EXTRACTION_MODEL });
  return cached;
}
