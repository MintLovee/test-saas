import type { Transition } from 'motion/react';

/**
 * iOS Fluid Interface / iOS 27 inspired spring presets.
 */
export const IOS_EASE = [0.32, 0.72, 0, 1] as const;

export const IOS_SPRING_SNAPPY: Transition = {
  type: 'spring',
  stiffness: 520,
  damping: 36,
  mass: 0.72,
};

export const IOS_SPRING_SHEET: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 34,
  mass: 0.85,
};

export const IOS_SPRING_POPOVER: Transition = {
  type: 'spring',
  stiffness: 480,
  damping: 32,
  mass: 0.7,
};

export const IOS_SPRING_CONTENT: Transition = {
  type: 'spring',
  stiffness: 430,
  damping: 34,
  mass: 0.78,
};

/**
 * iOS iMessage-style incoming/outgoing message bubble spring.
 */
export const IOS_SPRING_IMESSAGE: Transition = {
  type: 'spring',
  stiffness: 460,
  damping: 31,
  mass: 0.76,
};
