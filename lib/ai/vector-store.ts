import { QdrantVectorStore } from "@langchain/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";
import { getEmbeddings } from "./embeddings";

const DEFAULT_COLLECTION = "portfolio_chunks";

/**
 * Production is promoted via Qdrant aliases (blue-green swap): the stable
 * query name (`QDRANT_COLLECTION`) is an alias pointing at the current backing
 * collection. `QdrantVectorStore.ensureCollection()` only checks real
 * collections via `getCollections()` and would otherwise try to (re)create a
 * collection whose name is actually an alias. Wrapping the client makes
 * `getCollections()` alias-aware so the vector store treats the production
 * name as existing.
 */
function createAliasAwareClient(config: { url: string; apiKey?: string }): QdrantClient {
  const qdrant = new QdrantClient(config);

  return new Proxy(qdrant, {
    get(target, prop, receiver) {
      if (prop === "getCollections") {
        return async () => {
          const [collections, aliases] = await Promise.all([
            target.getCollections(),
            target.getAliases(),
          ]);
          const names = new Set(collections.collections.map((c) => c.name));
          for (const alias of aliases.aliases) names.add(alias.alias_name);
          return {
            collections: Array.from(names).map((name) => ({ name })),
          };
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export async function getVectorStore() {
  const embeddings = await getEmbeddings();
  const url = process.env.VECTOR_URL || "http://localhost:6333";
  const apiKey = process.env.VECTOR_API_KEY;
  const collectionName = process.env.QDRANT_COLLECTION || DEFAULT_COLLECTION;

  const config: Record<string, unknown> = {
    url,
    collectionName,
  };

  if (apiKey) {
    config.apiKey = apiKey;
  }

  config.client = createAliasAwareClient({ url, apiKey });

  return await QdrantVectorStore.fromExistingCollection(embeddings, config);
}
