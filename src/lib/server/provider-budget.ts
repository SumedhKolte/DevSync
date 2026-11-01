import { AsyncLocalStorage } from "node:async_hooks";

// Isolated per async job: concurrent requests never share a cancellation signal.
const budget = new AsyncLocalStorage<AbortSignal>();
export function withProviderBudget<T>(
  milliseconds: number,
  action: () => Promise<T>,
): Promise<T> {
  return budget.run(AbortSignal.timeout(milliseconds), action);
}
export function providerSignal() {
  const deadline = budget.getStore();
  deadline?.throwIfAborted();
  return deadline
    ? AbortSignal.any([deadline, AbortSignal.timeout(20000)])
    : AbortSignal.timeout(20000);
}
