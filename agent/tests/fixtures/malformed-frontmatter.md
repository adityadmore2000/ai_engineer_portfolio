---
schema_version: 1
type: project
title: "Malformed YAML value
slug: broken-spec
---

## Section {#broken}

This frontmatter is invalid: the `title` value's quote is never closed, so
`yaml.safe_load` must raise a structured error.