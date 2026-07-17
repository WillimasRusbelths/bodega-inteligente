import type { Environment } from "../../../config/env.schema.js";

export interface Argon2Configuration {
  readonly memoryCostKiB: number;
  readonly timeCost: number;
  readonly parallelism: number;
  readonly hashLength: number;
  readonly saltLength: number;
  readonly version: string;
}

/**
 * Conservative baseline for tests and local construction. Runtime composition
 * must use argon2ConfigurationFromEnvironment so production values stay
 * explicit and can be calibrated without changing persisted hashes.
 */
export const DEFAULT_ARGON2_CONFIGURATION: Readonly<Argon2Configuration> =
  Object.freeze({
    memoryCostKiB: 19_456,
    timeCost: 2,
    parallelism: 1,
    hashLength: 32,
    saltLength: 16,
    version: "argon2id-v1",
  });

type Argon2Environment = Pick<
  Environment,
  "ARGON2_MEMORY_KIB" | "ARGON2_ITERATIONS" | "ARGON2_PARALLELISM"
>;

export function argon2ConfigurationFromEnvironment(
  environment: Argon2Environment,
): Readonly<Argon2Configuration> {
  return Object.freeze({
    ...DEFAULT_ARGON2_CONFIGURATION,
    memoryCostKiB: environment.ARGON2_MEMORY_KIB,
    timeCost: environment.ARGON2_ITERATIONS,
    parallelism: environment.ARGON2_PARALLELISM,
  });
}
