---
schema_version: 1
type: project
slug: rich-body
title: Rich Body Project
status: in-development
technologies:
  - Python
  - OpenCV
  - Docker
---

## Interesting challenges {#challenges}

**Problem:** The video pipeline dropped frames under load.

**Solution:** A bounded queue with back-pressure between the decoder and the
inference workers.

**Outcome:** Sustained 30 FPS at 720p.

**Q:** Why not a bigger queue?

**A:** Latency, not throughput, was the binding constraint.

## Metrics table {#metrics}

| Metric    | Before | After |
|-----------|--------|-------|
| FPS       | 12     | 30    |
| CPU usage | 82%    | 61%   |

## Diagram {#diagram}

```mermaid
graph LR
  A[frames] --> B[decode]
  B --> C[infer]
```

> Callout: this blockquote must survive extraction untouched.

```python
def ping():
    return "pong"
```

![Decoded frames](/images/frames.png)