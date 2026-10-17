/** Where the time comes from: the application reads it, and a simulator stamps with it. */
export interface ClockPort {
  now: () => Date;
}
