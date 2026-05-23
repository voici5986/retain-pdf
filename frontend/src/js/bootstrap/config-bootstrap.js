import {
  applyKeyInputs,
  defaultMineruToken,
  defaultModelApiKey,
  defaultOcrProvider,
  defaultPaddleToken,
} from "../config.js";

export function applyPersistedConfig(state, persistedConfig) {
  const browserStored = persistedConfig.browserConfig || {};
  state.developerConfig = persistedConfig.developerConfig || {};
  applyKeyInputs(
    {
      ocrProvider: browserStored.ocrProvider || defaultOcrProvider(),
      mineruToken: browserStored.mineruToken || defaultMineruToken(),
      paddleToken: browserStored.paddleToken || defaultPaddleToken(),
      modelApiKey: browserStored.modelApiKey || defaultModelApiKey(),
    },
  );
}
