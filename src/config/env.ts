import { z } from "zod";
import "dotenv/config";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  EXTRACTION_MODEL: z.string().default("claude-sonnet-5"),

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
});

export const env = schema.parse(process.env);
export type Env = typeof env;
