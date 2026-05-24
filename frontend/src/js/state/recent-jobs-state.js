export function createRecentJobsState() {
  return {
    recentJobsOffset: 0,
    recentJobsHasMore: true,
    recentJobsItems: [],
  };
}

export function resetRecentJobsListState(target) {
  Object.assign(target, {
    recentJobsOffset: 0,
    recentJobsHasMore: true,
    recentJobsItems: [],
  });
}
