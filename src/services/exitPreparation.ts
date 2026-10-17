// Producers must flush final records before the write barrier stops admitting writes.
const preparations = new Set<() => Promise<void>>();
export function registerExitPreparation(prepare: () => Promise<void>) { preparations.add(prepare); return () => { preparations.delete(prepare); }; }
export async function prepareApplicationExit() { for (const prepare of [...preparations]) await prepare(); }
