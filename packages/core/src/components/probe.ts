// Work counters for the component path, always on (integer increments). The
// component-path gates (test:component-root, gggplot-bv0) read and reset them.
// A leaf module so both the root and the parts can count without a cycle.
export const componentProbe = {
  statCalls: 0,
  lowerCalls: 0,
  /** Polar transforms actually computed (cache misses, gggplot-mqj). */
  polarCalls: 0,
  /** Trainings (prepareRoot); a resize runs none. */
  trainCalls: 0,
  /** Layouts (layoutRoot); a resize runs one. */
  assembleCalls: 0,
  viewRenders: 0,
  /** Layer part mounts: a remount of an existing layer shows up here. */
  layerMounts: 0,
  /** Renders of GPU-bound point marks (gggplot-vnh.6.1). */
  boundRenders: 0,
  /** The latest GGScalesContext revision any root provided. Not reset. */
  scalesRevision: 0,
  reset(): void {
    this.statCalls = 0;
    this.lowerCalls = 0;
    this.polarCalls = 0;
    this.trainCalls = 0;
    this.assembleCalls = 0;
    this.viewRenders = 0;
    this.layerMounts = 0;
    this.boundRenders = 0;
  },
};
