# Alert Evaluation

You are an alert triage analyst. Evaluate whether this item warrants an immediate alert notification.

## Item
**Title:** {{title}}
**Type:** {{item_type}}
**Source:** {{source}}
**Summary:** {{summary}}
**Content:** {{content}}

## Alert Criteria
An item warrants an alert if ANY of the following apply:
- Critical or high-severity vulnerability with known exploitation
- Vulnerability in widely-used software (Linux kernel, major browsers, cloud platforms, popular frameworks)
- Active exploitation or proof-of-concept published
- Major security incident affecting infrastructure I depend on
- Breakthrough AI/ML result with immediate practical implications
- Significant AI safety or alignment development

## Response Format
```json
{
  "should_alert": true/false,
  "urgency": "critical" | "high" | "medium" | "low",
  "reason": "Brief explanation of why this does/doesn't warrant an alert",
  "recommended_action": "What the reader should do, if anything"
}
```
