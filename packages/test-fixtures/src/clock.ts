export interface TestClock {
  now(): Date;
}

export class ControlledClock implements TestClock {
  private currentTime: Date;

  public constructor(initialTime: string | Date) {
    this.currentTime = new Date(initialTime);
    if (Number.isNaN(this.currentTime.getTime()))
      throw new Error("A valid UTC instant is required.");
  }

  public now(): Date {
    return new Date(this.currentTime);
  }

  public set(instant: string | Date): void {
    const next = new Date(instant);
    if (Number.isNaN(next.getTime()))
      throw new Error("A valid UTC instant is required.");
    this.currentTime = next;
  }

  public advance(milliseconds: number): void {
    if (!Number.isFinite(milliseconds))
      throw new Error("A finite duration is required.");
    this.currentTime = new Date(this.currentTime.getTime() + milliseconds);
  }
}
