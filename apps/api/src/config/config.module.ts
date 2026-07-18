import { environmentSchema, type Environment } from "./env.schema.js";

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Readonly<Environment> {
  return Object.freeze(environmentSchema.parse(source));
}
