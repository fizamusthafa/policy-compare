import { TableClient, TableServiceClient } from "@azure/data-tables";

const connectionString =
  process.env.AZURE_STORAGE_CONNECTION_STRING ?? "UseDevelopmentStorage=true";

const TABLE_NAME = "policies";

function getTableClient(): TableClient {
  return TableClient.fromConnectionString(connectionString, TABLE_NAME);
}

export interface Coverage {
  type: string;
  limit: number;
  deductible: number;
  category: string;
  perOccurrence?: number;
  perDay?: boolean;
  maxDays?: number;
}

export interface Policy {
  id: string;
  type: string;
  carrier: string;
  policyNumber: string;
  holderName: string;
  effectiveDate: string;
  expirationDate: string;
  premiumMonthly: number;
  premiumAnnual: number;
  propertyAddress?: string;
  vehicleInfo?: string;
  policySubtype?: string;
  coverages: Coverage[];
  exclusions: string[];
  endorsements: string[];
  rating: number;
  claimsHistory: number;
}

export async function ensureTable(): Promise<void> {
  const serviceClient = TableServiceClient.fromConnectionString(connectionString);
  try {
    await serviceClient.createTable(TABLE_NAME);
  } catch (e: any) {
    if (e.statusCode !== 409) throw e; // 409 = table already exists
  }
}

export async function upsertPolicy(policy: Policy): Promise<void> {
  const client = getTableClient();
  const entity = {
    partitionKey: policy.type,
    rowKey: policy.id,
    data: JSON.stringify(policy),
  };
  await client.upsertEntity(entity, "Replace");
}

export async function getPolicy(id: string): Promise<Policy | null> {
  const client = getTableClient();
  const entities = client.listEntities({
    queryOptions: { filter: `RowKey eq '${id}'` },
  });
  for await (const entity of entities) {
    return JSON.parse(entity.data as string) as Policy;
  }
  return null;
}

export async function getAllPolicies(): Promise<Policy[]> {
  const client = getTableClient();
  const policies: Policy[] = [];
  const entities = client.listEntities();
  for await (const entity of entities) {
    policies.push(JSON.parse(entity.data as string) as Policy);
  }
  return policies;
}

export async function getPoliciesByType(type: string): Promise<Policy[]> {
  const client = getTableClient();
  const policies: Policy[] = [];
  const entities = client.listEntities({
    queryOptions: { filter: `PartitionKey eq '${type}'` },
  });
  for await (const entity of entities) {
    policies.push(JSON.parse(entity.data as string) as Policy);
  }
  return policies;
}

export async function searchPolicies(filters: {
  type?: string;
  carrier?: string;
  minCoverage?: number;
}): Promise<Policy[]> {
  const all = filters.type
    ? await getPoliciesByType(filters.type)
    : await getAllPolicies();

  return all.filter((p) => {
    if (filters.carrier && !p.carrier.toLowerCase().includes(filters.carrier.toLowerCase())) {
      return false;
    }
    if (filters.minCoverage) {
      const maxLimit = Math.max(...p.coverages.map((c) => c.limit));
      if (maxLimit < filters.minCoverage) return false;
    }
    return true;
  });
}

export async function deletePolicy(id: string): Promise<boolean> {
  const policy = await getPolicy(id);
  if (!policy) return false;
  const client = getTableClient();
  await client.deleteEntity(policy.type, id);
  return true;
}
