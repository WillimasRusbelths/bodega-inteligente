import { redactLogText, redactLogValue } from "./redaction.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface StructuredLogRecord {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly context?: unknown;
}

export interface LogSink {
  write(record: Readonly<StructuredLogRecord>): void;
}

export interface LoggerClock {
  now(): Date;
}

const systemClock: LoggerClock = { now: () => new Date() };
const discardSink: LogSink = { write: () => undefined };

export class StructuredLoggerService {
  public constructor(
    private readonly sink: LogSink = discardSink,
    private readonly clock: LoggerClock = systemClock,
  ) {}

  public debug(message: string, context?: unknown): void {
    this.write("debug", message, context);
  }

  public info(message: string, context?: unknown): void {
    this.write("info", message, context);
  }

  public warn(message: string, context?: unknown): void {
    this.write("warn", message, context);
  }

  public error(message: string, error?: unknown): void {
    this.write("error", message, error);
  }

  private write(level: LogLevel, message: string, context?: unknown): void {
    this.sink.write(
      Object.freeze({
        timestamp: this.clock.now().toISOString(),
        level,
        message: redactLogText(message),
        ...(context === undefined ? {} : { context: redactLogValue(context) }),
      }),
    );
  }
}
