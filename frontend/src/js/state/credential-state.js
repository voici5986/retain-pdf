export function createCredentialState() {
  return {
    validatedOcrProvider: "",
    validatedOcrToken: "",
    ocrValidationStatus: "",
  };
}

export function resetOcrValidationState(target) {
  Object.assign(target, createCredentialState());
}
