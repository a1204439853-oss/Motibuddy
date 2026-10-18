import { MotionConfig } from 'framer-motion';
import type { PropsWithChildren } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { neoTransition } from '@/lib/neoMotion';

export default function NeoMotionProvider({ children }: PropsWithChildren) {
  const reduced = useReducedMotion();
  return <MotionConfig reducedMotion={reduced ? 'always' : 'never'} transition={reduced ? { duration: 0 } : neoTransition}>{children}</MotionConfig>;
}
