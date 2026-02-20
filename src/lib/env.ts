import { z } from "zod";

const DEFAULT_VAPI_ALLOWED_ORIGINS = [
  "https://vapi.ai",
  "https://www.vapi.ai",
  "https://dashboard.vapi.ai",
  "https://app.vapi.ai",
  "https://api.vapi.ai",
] as const;

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().default("file:./dev.db"),
  EV_PRIVATE_TOKEN: z.string().optional(),
  NEXT_PUBLIC_EV_WEB_KEY: z.string().optional(),
  VAPI_DEFAULT_AGENT_ID: z.string().default("e32ec77b-bf48-412b-9d2b-857bf089eb8d"),
  EV_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  EV_WEBHOOK_SECRET: z.string().optional(),
  EV_DEFAULT_ORG_SLUG: z.string().default("eburon-demo"),
  EV_DEFAULT_ORG_NAME: z.string().default("Eburon Demo"),
  EV_DEFAULT_USER_EMAIL: z.string().default("owner@eburon.local"),
  EV_RATE_LIMIT_USER_PER_MINUTE: z.coerce.number().int().positive().default(60),
  EV_RATE_LIMIT_ORG_PER_MINUTE: z.coerce.number().int().positive().default(300),
  EV_RATE_LIMIT_FAILED_PER_10_MIN: z.coerce.number().int().positive().default(30),
  EV_PREVIEW_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(900),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("crm-assets"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment: ${parsed.error.message}`);
}

export const env = {
  ...parsed.data,
  allowedOrigins: Array.from(
    new Set(
      [
        ...parsed.data.EV_ALLOWED_ORIGINS.split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        ...DEFAULT_VAPI_ALLOWED_ORIGINS,
      ],
    ),
  ),
};

export function isProd(): boolean {
  return env.NODE_ENV === "production";
}
