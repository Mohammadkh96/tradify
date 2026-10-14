export const retiredAiEndpoint =
  /^\/api\/(?:ai(?:\/|$)|monthly-review\/[^/]+$|trades\/[^/]+\/ai-tags$|compliance\/explain$|education\/ai-tutor$|generate-image$|admin\/marketing\/(?:generate(?:\/|$)|studio(?:\/|$)|smart-suggestions$|pipeline\/run$|funnel\/generate(?:-single)?$|content\/(?:[^/]+\/repurpose|fill-week)$|ad-strategy$)|conversations\/[^/]+\/(?:messages|voice-stream)$)/i;

export function isRetiredAiPath(path: string): boolean {
  return retiredAiEndpoint.test(path);
}

export function isRetiredAiRequest(method: string, path: string): boolean {
  if (!isRetiredAiPath(path)) return false;

  if (/^\/api\/(?:ai(?:\/|$)|monthly-review\/[^/]+$|compliance\/explain$|conversations\/[^/]+\/(?:messages|voice-stream)$)/i.test(path)) {
    return true;
  }

  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}
