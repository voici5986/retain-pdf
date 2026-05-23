export async function checkApiConnectivity(features) {
  await features.appActionsFeature?.checkApiConnectivity();
}
