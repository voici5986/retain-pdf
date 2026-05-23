import { TRANSLATION_PROVIDER_DEFINITION } from "../../provider-config.js";
import {
  browserCredentialElements,
  setDeepSeekAccountStatus,
  setDeepSeekValidationMessage,
} from "./view.js";
import {
  runDeepSeekBalanceCheck,
  runDeepSeekConnectivityCheck,
  summarizeDeepSeekBalance,
} from "./validation.js";

function currentTimeLabel() {
  return new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export async function handleBrowserDeepSeekValidate({
  validateDeepSeekToken,
  queryDeepSeekBalance,
}) {
  const {
    apiKeyInput,
    modelBaseUrlInput,
  } = browserCredentialElements();
  const baseUrl = modelBaseUrlInput?.value?.trim() || "";
  setDeepSeekValidationMessage("正在检测 DeepSeek 和余额…");
  const result = await runDeepSeekConnectivityCheck({
    apiKey: apiKeyInput?.value || "",
    baseUrl,
    validateDeepSeekToken,
    setDeepSeekValidationMessage,
    showResult: false,
  });
  if (result.ok) {
    const balance = await runDeepSeekBalanceCheck({
      apiKey: apiKeyInput?.value || "",
      baseUrl,
      queryDeepSeekBalance,
    });
    if (balance.status === "unsupported_provider") {
      setDeepSeekValidationMessage("DeepSeek 可用", "valid");
      setDeepSeekAccountStatus("接口可用，当前 provider 不支持余额查询", "valid", currentTimeLabel());
      return;
    }
    if (balance.status === "network_error") {
      setDeepSeekValidationMessage("DeepSeek 可用，余额查询失败", "valid");
      setDeepSeekAccountStatus("接口可用，余额查询失败", "valid", currentTimeLabel());
      return;
    }
    const balanceSummary = summarizeDeepSeekBalance(balance);
    setDeepSeekValidationMessage(
      `DeepSeek 可用，${balanceSummary}`,
      balance.is_available ? "valid" : "error",
    );
    setDeepSeekAccountStatus(balanceSummary, balance.is_available ? "valid" : "error", currentTimeLabel());
    return;
  }
  setDeepSeekValidationMessage(
    result.summary || TRANSLATION_PROVIDER_DEFINITION.validationNetworkMessage,
    "error",
  );
  setDeepSeekAccountStatus(result.summary || "接口不可用", "error", currentTimeLabel());
}
