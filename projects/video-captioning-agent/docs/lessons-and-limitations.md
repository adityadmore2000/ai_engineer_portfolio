---
order: 8
---

## Limitations

There's no automated check that a styled caption stays true to the facts; the only real safeguard is that the rewriting step simply has no access to anything beyond the factual summary. The performance numbers mentioned above are estimates from the design phase rather than results from an actual measured run, and there's no automated testing pipeline, so tests only run when someone remembers to run them by hand. A few settings that probably should be configurable - like how many frames get sampled or which models are used - are currently hardcoded. An earlier attempt at a dedicated model deployment was abandoned once it became clear the provider's API didn't work the way the plan assumed.
