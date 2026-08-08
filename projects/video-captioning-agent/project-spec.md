---
schema_version: 1
type: project
slug: video-captioning-agent
title: Video Captioning Agent
---

## Results {#results}

The full pipeline works end-to-end, from downloading a video through writing out the final results safely. It's packaged as a Docker image well within the size limit, backed by a real test suite covering the trickier concurrency behavior and failure handling. There's a working Streamlit demo with a bundled sample clip, a side-project for experimenting with prompts and model settings, and a solid set of docs covering the design, the original spec, and what's been tried so far.

## Limitations {#limitations}

There's no automated check that a styled caption stays true to the facts; the only real safeguard is that the rewriting step simply has no access to anything beyond the factual summary. The performance numbers mentioned above are estimates from the design phase rather than results from an actual measured run, and there's no automated testing pipeline, so tests only run when someone remembers to run them by hand. A few settings that probably should be configurable - like how many frames get sampled or which models are used - are currently hardcoded. An earlier attempt at a dedicated model deployment was abandoned once it became clear the provider's API didn't work the way the plan assumed.

## Future Improvements {#future-improvements}

The most valuable next step would be a real accuracy check that flags a caption if it claims something the original factual summary never said. After that: finishing the dedicated deployment setup now that the real constraints are understood, adding retry logic so a flaky network call doesn't silently produce an empty caption, and setting up automated testing so nothing slips through unnoticed. Moving the hardcoded settings into configuration would let the project be re-tuned without code changes, and running an actual benchmark would replace the current design estimates with real numbers. Longer-term, fine-tuning the vision model on a proper video-captioning dataset could meaningfully improve accuracy on trickier footage.
