import { checkApiConnectivity } from "./api-connectivity.js";
import { bindFeatureEvents } from "./bind-feature-events.js";
import { createFeatureSlots } from "./feature-slots.js";
import { mountCredentialAndActionFeatures } from "./mount-credential-action-features.js";
import { mountGlossaryFeature } from "./mount-glossary-feature.js";
import { mountCoreFeatures } from "./mount-core-features.js";
import { mountJobFeatures } from "./mount-job-features.js";
import { mountUploadWorkflowFeatures } from "./mount-upload-workflow-features.js";

export function mountApplicationFeatures() {
  const features = createFeatureSlots();
  mountCoreFeatures(features);
  mountUploadWorkflowFeatures(features);
  mountGlossaryFeature(features);
  mountCredentialAndActionFeatures(features);
  mountJobFeatures(features);
  bindFeatureEvents(features);
  return {
    ...features,
    checkApiConnectivity: () => checkApiConnectivity(features),
  };
}
