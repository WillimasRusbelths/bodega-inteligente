import type { components } from "@bodegia/api-contract";

type MembershipChoice = components["schemas"]["MembershipChoice"];

export interface SecureStoreBridge {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface StoredSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly absoluteExpiresAt: string;
  readonly activeContext: MembershipChoice | null;
}

const keys = Object.freeze({
  accessToken: "bodegia.session.access",
  refreshToken: "bodegia.session.refresh",
  absoluteExpiresAt: "bodegia.session.absolute-expiry",
  activeContext: "bodegia.session.active-context",
});

/** Credentials are persisted only through an injected native SecureStore bridge. */
export class SecureSessionStore {
  public constructor(private readonly bridge: SecureStoreBridge) {}

  public async replace(session: StoredSession): Promise<void> {
    await Promise.all([
      this.bridge.setItemAsync(keys.accessToken, session.accessToken),
      this.bridge.setItemAsync(keys.refreshToken, session.refreshToken),
      this.bridge.setItemAsync(
        keys.absoluteExpiresAt,
        session.absoluteExpiresAt,
      ),
      this.bridge.setItemAsync(
        keys.activeContext,
        JSON.stringify(session.activeContext),
      ),
    ]);
  }

  public async replaceAccessContext(input: {
    readonly accessToken: string;
    readonly activeContext: MembershipChoice;
  }): Promise<void> {
    await Promise.all([
      this.bridge.setItemAsync(keys.accessToken, input.accessToken),
      this.bridge.setItemAsync(
        keys.activeContext,
        JSON.stringify(input.activeContext),
      ),
    ]);
  }

  public async load(): Promise<StoredSession | null> {
    const [accessToken, refreshToken, absoluteExpiresAt, activeContext] =
      await Promise.all([
        this.bridge.getItemAsync(keys.accessToken),
        this.bridge.getItemAsync(keys.refreshToken),
        this.bridge.getItemAsync(keys.absoluteExpiresAt),
        this.bridge.getItemAsync(keys.activeContext),
      ]);
    if (
      accessToken === null ||
      refreshToken === null ||
      absoluteExpiresAt === null
    ) {
      return null;
    }
    return {
      accessToken,
      refreshToken,
      absoluteExpiresAt,
      activeContext:
        activeContext === null
          ? null
          : (JSON.parse(activeContext) as MembershipChoice | null),
    };
  }

  public async accessToken(): Promise<string | null> {
    return this.bridge.getItemAsync(keys.accessToken);
  }

  public async clear(): Promise<void> {
    await Promise.all(
      Object.values(keys).map((key) => this.bridge.deleteItemAsync(key)),
    );
  }
}
