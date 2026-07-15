export type RuntimeEnvironment =
  | "local"
  | "development"
  | "test"
  | "staging"
  | "production";

export interface EnvironmentGuardInput {
  readonly nodeEnvironment: "development" | "test" | "production";
  readonly appEnvironment: RuntimeEnvironment;
  readonly databaseEnvironment: RuntimeEnvironment;
  readonly secretsEnvironment: RuntimeEnvironment;
  readonly databaseUrl: string;
}

const productionUrlMarker = /(^|[.:/@_-])(prod|production)([.:/@_-]|$)/iu;

export function assertSafeEnvironment(
  input: Partial<EnvironmentGuardInput>,
): asserts input is EnvironmentGuardInput {
  const required = [
    input.nodeEnvironment,
    input.appEnvironment,
    input.databaseEnvironment,
    input.secretsEnvironment,
    input.databaseUrl,
  ];

  if (required.some((value) => value === undefined || value === "")) {
    throw new Error("Required environment configuration is missing.");
  }

  if (input.databaseUrl === undefined) {
    throw new Error("Required environment configuration is missing.");
  }

  if (
    input.appEnvironment !== input.databaseEnvironment ||
    input.appEnvironment !== input.secretsEnvironment
  ) {
    throw new Error(
      "Application, database, and secret environments must match.",
    );
  }

  if (input.nodeEnvironment === "test") {
    if (
      input.appEnvironment === "production" ||
      productionUrlMarker.test(input.databaseUrl)
    ) {
      throw new Error(
        "Tests must never use production configuration or credentials.",
      );
    }
  }
}
