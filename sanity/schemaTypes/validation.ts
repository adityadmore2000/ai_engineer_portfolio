import type { UrlRule } from "sanity";

export function urlRule(rule: UrlRule) {
  return rule.uri({
    scheme: ["http", "https", "mailto"]
  });
}
