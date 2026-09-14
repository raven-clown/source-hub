import { z } from "zod";
import "dotenv/config";

const schema = z.object({
  DATABASE_URL: z.string().min(1),

  LLM_PROVIDER: z.enum(["anthropic", "openai_compatible"]).default("anthropic"),

  ANTHROPIC_API_KEY: z.string().optional(),
  EXTRACTION_MODEL: z.string().default("claude-sonnet-5"),

  OPENAI_COMPATIBLE_API_KEY: z.string().optional(),
  OPENAI_COMPATIBLE_BASE_URL: z.string().optional(),
  OPENAI_COMPATIBLE_MODEL: z.string().optional(),

  GMAIL_CLIENT_ID: z.string().optional(),
  GMAIL_CLIENT_SECRET: z.string().optional(),
  GMAIL_REFRESH_TOKEN: z.string().optional(),

  NOTION_API_KEY: z.string().optional(),

  LINEAR_API_KEY: z.string().optional(),

  GCAL_CLIENT_ID: z.string().optional(),
  GCAL_CLIENT_SECRET: z.string().optional(),
  GCAL_REFRESH_TOKEN: z.string().optional(),
  GCAL_CALENDAR_ID: z.string().default("primary"),

  API_PORT: z.coerce.number().default(3000),
  API_KEY: z.string().optional(),
  API_CORS_ORIGIN: z.string().default("*"),
}).superRefine((val, ctx) => {
  if (val.LLM_PROVIDER === "anthropic" && !val.ANTHROPIC_API_KEY) {
    ctx.addIssue({ code: "custom", path: ["ANTHROPIC_API_KEY"], message: "required when LLM_PROVIDER=anthropic" });
  }
  if (val.LLM_PROVIDER === "openai_compatible" && (!val.OPENAI_COMPATIBLE_BASE_URL || !val.OPENAI_COMPATIBLE_MODEL)) {
    ctx.addIssue({
      code: "custom",
      path: ["OPENAI_COMPATIBLE_BASE_URL"],
      message: "OPENAI_COMPATIBLE_BASE_URL and OPENAI_COMPATIBLE_MODEL are required when LLM_PROVIDER=openai_compatible",
    });
  }
});

export const env = schema.parse(process.env);
export type Env = typeof env;
