---
order: 9
---

## Future Improvements

The most valuable next step would be a real accuracy check that flags a caption if it claims something the original factual summary never said. After that: finishing the dedicated deployment setup now that the real constraints are understood, adding retry logic so a flaky network call doesn't silently produce an empty caption, and setting up automated testing so nothing slips through unnoticed. Moving the hardcoded settings into configuration would let the project be re-tuned without code changes, and running an actual benchmark would replace the current design estimates with real numbers. Longer-term, fine-tuning the vision model on a proper video-captioning dataset could meaningfully improve accuracy on trickier footage.
