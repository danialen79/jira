# EvidenceCard protocol

All subagents return a **ResearchBrief**:

```json
{
  "summary": "…",
  "cards": [
    {
      "claim": "…",
      "confidence": "high|medium|low",
      "sources": [{ "kind": "knowledge|jira|web", "ref": "…", "snippet": "…" }],
      "suggestedQuestion": {
        "prompt": "…",
        "choices": ["…", "…"],
        "coverageKey": "goal"
      },
      "openGaps": ["…"],
      "collide": "reuse|extend|net-new"
    }
  ]
}
```

- Parent model sees only this brief (via toModelOutput), not raw tool dumps.
- UI may show chips from `sources` and activity from consult* tool names.
