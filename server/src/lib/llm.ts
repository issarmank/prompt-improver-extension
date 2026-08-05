// The actual LLM API call that rewrites a prompt.
// Real provider integration lands in a later feature; for now this echoes a
// deterministic rewrite so the endpoint contract can be exercised end to end.

export interface RewriteResult {
  improved: string;
}

export async function rewritePrompt(text: string): Promise<RewriteResult> {
  if (process.env.LLM_API_KEY) {
    throw new Error('LLM provider integration not implemented yet');
  }
  return { improved: text.trim() };
}
