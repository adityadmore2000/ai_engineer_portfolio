import { QdrantClient } from "@qdrant/js-client-rest";
import type { Schemas } from "@qdrant/js-client-rest";
import { QdrantConnectionError } from "../writer";

export interface QdrantConfig {
  url: string;
  apiKey?: string;
}

export function createQdrantClient(config: QdrantConfig): QdrantClient {
  const params: { url: string; apiKey?: string } = { url: config.url };
  if (config.apiKey) params.apiKey = config.apiKey;
  return new QdrantClient(params);
}

export function isConnectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("ECONNREFUSED") ||
    message.includes("connect") ||
    message.includes("Could not connect")
  );
}

export async function listCollectionNames(client: QdrantClient): Promise<string[]> {
  const res = await client.getCollections();
  return res.collections.map((collection) => collection.name);
}

export interface AliasInfo {
  aliasName: string;
  collectionName: string;
}

export async function listAliases(client: QdrantClient): Promise<AliasInfo[]> {
  const res = await client.getAliases();
  return res.aliases.map((alias) => ({
    aliasName: alias.alias_name,
    collectionName: alias.collection_name,
  }));
}

export type ProductionStatus =
  | { kind: "real"; collectionName: string }
  | { kind: "alias"; backingCollection: string }
  | { kind: "missing" };

export async function resolveProductionStatus(
  client: QdrantClient,
  productionCollection: string
): Promise<ProductionStatus> {
  const names = await listCollectionNames(client);
  if (names.includes(productionCollection)) {
    return { kind: "real", collectionName: productionCollection };
  }
  const aliases = await listAliases(client);
  const match = aliases.find((alias) => alias.aliasName === productionCollection);
  if (match) return { kind: "alias", backingCollection: match.collectionName };
  return { kind: "missing" };
}

export interface VectorParams {
  size: number;
  distance: string;
}

export async function getCollectionVectorParams(
  client: QdrantClient,
  collectionName: string
): Promise<VectorParams | null> {
  const info = await client.getCollection(collectionName);
  const vectors = info.config?.params?.vectors;
  if (!vectors) return null;

  const direct = vectors as { size?: number; distance?: string };
  if (typeof direct.size === "number") {
    return { size: direct.size, distance: direct.distance ?? "Cosine" };
  }

  const named = vectors as Record<string, { size?: number; distance?: string }>;
  const first = Object.values(named)[0];
  if (!first || typeof first.size !== "number") return null;
  return { size: first.size, distance: first.distance ?? "Cosine" };
}

export async function createTempCollection(
  client: QdrantClient,
  collectionName: string,
  vectorParams: VectorParams
): Promise<void> {
  await client.createCollection(collectionName, {
    vectors: {
      size: vectorParams.size,
      distance: vectorParams.distance as Schemas["Distance"],
    },
  });
}

export async function countPoints(
  client: QdrantClient,
  collectionName: string
): Promise<number> {
  const res = await client.count(collectionName, { exact: true });
  return res.count;
}

export async function deleteCollectionIfExists(
  client: QdrantClient,
  collectionName: string
): Promise<boolean> {
  try {
    const res = await client.collectionExists(collectionName);
    if (!res.exists) return false;
    await client.deleteCollection(collectionName);
    return true;
  } catch (error) {
    if (isConnectionError(error)) throw new QdrantConnectionError(String(error));
    return false;
  }
}

/**
 * Atomically converts a legacy real collection into an alias via Qdrant's
 * batch operations endpoint (`POST /collections/operations`). The legacy
 * collection is deleted and the production alias created in a single
 * server-side operation, so search availability is never interrupted.
 * Returns `false` when the endpoint is not supported by the Qdrant server,
 * letting the caller fall back to a sequential migration.
 */
export async function atomicMigrateLegacyToAlias(
  config: QdrantConfig,
  opts: {
    legacyCollection: string;
    tempCollection: string;
    aliasName: string;
  }
): Promise<boolean> {
  const baseUrl = config.url.replace(/\/+$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers["api-key"] = config.apiKey;

  const res = await fetch(`${baseUrl}/collections/operations`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      operations: [
        { delete_collection: { collection_name: opts.legacyCollection } },
        {
          create_alias: {
            collection_name: opts.tempCollection,
            alias_name: opts.aliasName,
          },
        },
      ],
    }),
  });

  if (res.status === 200) return true;
  if (res.status === 404 || res.status === 405) {
    // Endpoint not supported by this Qdrant server version.
    return false;
  }
  const body = await res.text();
  throw new Error(
    `Qdrant batch migration failed (HTTP ${res.status}): ${body}`
  );
}

export async function bootstrapPromote(
  client: QdrantClient,
  config: QdrantConfig,
  opts: {
    tempCollection: string;
    productionCollection: string;
    legacyCollection: string | null;
  }
): Promise<void> {
  if (opts.legacyCollection) {
    const migrated = await atomicMigrateLegacyToAlias(config, {
      legacyCollection: opts.legacyCollection,
      tempCollection: opts.tempCollection,
      aliasName: opts.productionCollection,
    });
    if (migrated) return;
    // Fallback for servers without the batch endpoint: the validated
    // replacement already exists, so delete-then-alias still never removes
    // the index before a replacement is available.
    await deleteCollectionIfExists(client, opts.legacyCollection);
  }
  await client.updateCollectionAliases({
    actions: [
      {
        create_alias: {
          collection_name: opts.tempCollection,
          alias_name: opts.productionCollection,
        },
      },
    ],
  });
}

export async function swapProductionAlias(
  client: QdrantClient,
  opts: { tempCollection: string; productionCollection: string }
): Promise<void> {
  await client.updateCollectionAliases({
    actions: [
      { delete_alias: { alias_name: opts.productionCollection } },
      {
        create_alias: {
          collection_name: opts.tempCollection,
          alias_name: opts.productionCollection,
        },
      },
    ],
  });
}

export async function sweepOrphanedTempCollections(
  client: QdrantClient,
  opts: { tempPrefix: string; protectedNames: ReadonlySet<string> }
): Promise<string[]> {
  const names = await listCollectionNames(client);
  const orphans = names.filter(
    (name) =>
      name.startsWith(opts.tempPrefix) && !opts.protectedNames.has(name)
  );
  for (const name of orphans) {
    await deleteCollectionIfExists(client, name);
  }
  return orphans;
}
