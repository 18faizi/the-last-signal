/**
 * Governs how the access evaluator consumes items when a lock is opened.
 *
 * - Retain      : item stays in inventory after use (access cards, keycards
 *                 used for multiple doors).
 * - ConsumeOne  : one unit is removed from the stack.
 * - ConsumeAll  : every unit in the stack is removed.
 */
export type ConsumptionPolicy = 'retain' | 'consume-one' | 'consume-all';
