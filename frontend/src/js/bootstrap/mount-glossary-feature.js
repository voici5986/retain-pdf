import { API_PREFIX } from "../constants.js";
import { mountGlossariesFeature } from "../features/glossaries/controller.js";
import {
  createGlossary,
  deleteGlossary,
  fetchGlossaries,
  fetchGlossary,
  parseGlossaryCsv,
  updateGlossary,
} from "../api/glossaries.js";

export function mountGlossaryFeature(features) {
  features.glossariesFeature = mountGlossariesFeature({
    apiPrefix: API_PREFIX,
    fetchGlossaries,
    fetchGlossary,
    createGlossary,
    updateGlossary,
    deleteGlossary,
    parseGlossaryCsv,
    refreshWorkflowGlossaries: (options) => features.workflowFeature?.loadGlossaryOptions(options),
  });
}
