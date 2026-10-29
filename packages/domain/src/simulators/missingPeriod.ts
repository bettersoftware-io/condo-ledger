import { type Observable, throwError } from "rxjs";

/** What a simulator's stream fails with when it holds no books for the period. */
export function missingPeriod<T>(periodId: string): Observable<T> {
  return throwError(() => {
    return new Error(`missing: the period ${periodId}`);
  });
}
