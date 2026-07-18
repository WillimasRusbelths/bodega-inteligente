import { z } from "zod";

const positiveInteger = z.coerce.number().int().positive();

export const environmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    APP_ENV: z.enum(["local", "development", "test", "staging", "production"]),
    DATABASE_ENVIRONMENT: z.enum([
      "local",
      "development",
      "test",
      "staging",
      "production",
    ]),
    SECRETS_ENVIRONMENT: z.enum([
      "local",
      "development",
      "test",
      "staging",
      "production",
    ]),
    DATABASE_URL: z.url(),
    ACCESS_TOKEN_TTL_SECONDS: positiveInteger.max(600).default(600),
    SESSION_ABSOLUTE_TTL_SECONDS: positiveInteger.max(28_800).default(28_800),
    PIN_LOCKOUT_SECONDS: positiveInteger.default(900),
    ARGON2_MEMORY_KIB: positiveInteger,
    ARGON2_ITERATIONS: positiveInteger,
    ARGON2_PARALLELISM: positiveInteger,
    PIN_PEPPER_CURRENT_VERSION: z.string().min(1),
    PHONE_BINDING_HMAC_CURRENT_VERSION: z.string().min(1),
    PHONE_BINDING_HMAC_KEYS_JSON: z.string().min(1),
  })
  .strict();

export type Environment = z.infer<typeof environmentSchema>;
