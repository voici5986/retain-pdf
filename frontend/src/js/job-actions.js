import {
  hasReadyManifestArtifact,
  resolveManifestArtifactUrl,
  resolveJobMarkdownContract,
  toAbsoluteApiUrl,
} from "./job-artifacts.js";
import { firstNonEmpty } from "./job-core.js";

function artifactDisplayItem(job, ...keys) {
  const items = Array.isArray(job?.artifacts_display) ? job.artifacts_display : [];
  return items.find((item) => keys.includes(item?.key) || keys.includes(item?.kind)) || null;
}

function artifactDisplayReady(job, ...keys) {
  const item = artifactDisplayItem(job, ...keys);
  return Boolean(item?.ready);
}

function artifactDisplayUrl(job, ...keys) {
  const item = artifactDisplayItem(job, ...keys);
  return toAbsoluteApiUrl(firstNonEmpty(item?.download_url, item?.url, item?.path));
}

export function resolveJobActions(job) {
  const artifacts = job.artifacts || {};
  const links = job.links || {};
  const actions = job.actions || {};
  const artifactActions = artifacts.actions || {};
  const markdownContract = resolveJobMarkdownContract(job);
  const bundleEnabled = Boolean(
    actions.download_bundle?.enabled
    || artifactActions.download_bundle?.enabled
    || artifacts.bundle?.ready
    || artifacts.bundle_ready
    || job.bundle_ready
    || artifactDisplayReady(job, "bundle", "download_bundle", "archive")
  );
  const pdfEnabled = Boolean(
    actions.download_pdf?.enabled
    || artifactActions.download_pdf?.enabled
    || artifacts.pdf?.ready
    || artifacts.pdf_ready
    || job.pdf_ready
    || job.output_pdf_ready
    || artifactDisplayReady(job, "output_pdf", "pdf", "translated_pdf", "result_pdf")
  );
  const markdownJsonEnabled = Boolean(
    actions.open_markdown?.enabled
    || artifactActions.open_markdown?.enabled
    || markdownContract.ready
    || artifactDisplayReady(job, "markdown")
  );
  const markdownRawEnabled = Boolean(
    actions.open_markdown_raw?.enabled
    || artifactActions.open_markdown_raw?.enabled
    || markdownContract.ready
    || artifactDisplayReady(job, "markdown")
  );
  const rerunEnabled = Boolean(actions.rerun?.enabled ?? artifactActions.rerun?.enabled);
  return {
    cancelEnabled: Boolean(actions.cancel?.enabled ?? artifactActions.cancel?.enabled ?? (job.status === "queued" || job.status === "running")),
    rerunEnabled,
    bundleEnabled,
    pdfEnabled,
    markdownJsonEnabled,
    markdownRawEnabled,
    cancel: toAbsoluteApiUrl(firstNonEmpty(
      actions.cancel?.url,
      artifactActions.cancel?.url,
      actions.cancel_url,
      links.cancel_url,
      links.cancel_path,
    )),
    rerun: toAbsoluteApiUrl(firstNonEmpty(
      actions.rerun?.url,
      artifactActions.rerun?.url,
      actions.rerun?.path,
      artifactActions.rerun?.path,
      actions.rerun_url,
      links.rerun_url,
      links.rerun_path,
    )),
    bundle: toAbsoluteApiUrl(firstNonEmpty(
      actions.download_bundle?.url,
      actions.download_bundle?.path,
      artifactActions.download_bundle?.url,
      artifactActions.download_bundle?.path,
      artifacts.bundle?.url,
      artifacts.bundle?.path,
      artifacts.bundle_url,
      artifacts.bundle_path,
      job.bundle_url,
      job.bundle_path,
      artifactDisplayUrl(job, "bundle", "download_bundle", "archive"),
    )),
    pdf: toAbsoluteApiUrl(firstNonEmpty(
      actions.download_pdf?.url,
      actions.download_pdf?.path,
      artifactActions.download_pdf?.url,
      artifactActions.download_pdf?.path,
      artifacts.pdf?.url,
      artifacts.pdf?.path,
      artifacts.pdf_url,
      artifacts.pdf_path,
      job.pdf_url,
      job.pdf_path,
      artifactDisplayUrl(job, "output_pdf", "pdf", "translated_pdf", "result_pdf"),
    )),
    markdownJson: markdownContract.jsonUrl || artifactDisplayUrl(job, "markdown") || toAbsoluteApiUrl(firstNonEmpty(
      actions.open_markdown?.url,
      actions.open_markdown?.path,
      artifactActions.open_markdown?.url,
      artifactActions.open_markdown?.path,
    )),
    markdownRaw: markdownContract.rawUrl || artifactDisplayUrl(job, "markdown") || toAbsoluteApiUrl(firstNonEmpty(
      actions.open_markdown_raw?.url,
      actions.open_markdown_raw?.path,
      artifactActions.open_markdown_raw?.url,
      artifactActions.open_markdown_raw?.path,
    )),
  };
}

export function resolveJobSourcePdfAction(job, manifestPayload = null) {
  const artifacts = job?.artifacts || {};
  const manifestUrl = resolveManifestArtifactUrl(manifestPayload, "source_pdf");
  const fallbackUrl = job?.job_id
    ? `/api/v1/jobs/${encodeURIComponent(job.job_id)}/artifacts/source_pdf`
    : "";
  const url = toAbsoluteApiUrl(firstNonEmpty(
    manifestUrl,
    artifacts.source_pdf?.url,
    artifacts.source_pdf?.path,
    artifacts.source_pdf_url,
    artifacts.source_pdf_path,
    job?.source_pdf_url,
    job?.source_pdf_path,
    fallbackUrl,
  ));
  const ready = Boolean(
    hasReadyManifestArtifact(manifestPayload, "source_pdf")
    || artifacts.source_pdf?.ready
    || artifacts.source_pdf_ready
    || job?.source_pdf_ready
    || url
  );
  return {
    ready,
    url,
  };
}
