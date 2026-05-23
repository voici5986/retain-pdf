export function createRecentJobsState() {
  return {
    recentJobsOffset: 0,
    recentJobsHasMore: true,
    recentJobsDate: "",
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
