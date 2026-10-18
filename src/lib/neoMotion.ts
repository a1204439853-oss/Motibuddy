/** Shared motion grammar: short travel, hard stops, no elastic layout changes. */
export const neoEase = [0.2, 0.8, 0.2, 1] as const;
export const neoTransition = { duration: 0.18, ease: neoEase };
