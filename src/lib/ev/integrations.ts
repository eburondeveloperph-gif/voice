import type { Integration, IntegrationMode, IntegrationStatus } from "@prisma/client";

const maskedSecret = "********";

export const integrationCategoryLabels = {
  tool_providers: "Tool Providers",
  vector_store_providers: "Vector Store Providers",
  phone_number_providers: "Phone Number Providers",
  cloud_providers: "Cloud Providers",
  observability_providers: "Observability Providers",
  server_configuration: "Server Configuration",
} as const;

export type IntegrationCategoryKey = keyof typeof integrationCategoryLabels;

export type IntegrationFieldType =
  | "text"
  | "password"
  | "number"
  | "boolean"
  | "json"
  | "select";

export type IntegrationFieldOption = {
  value: string;
  label: string;
};

export type IntegrationFieldDefinition = {
  key: string;
  label: string;
  type: IntegrationFieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: IntegrationFieldOption[];
  defaultValue?: string | number | boolean;
};

type BuildPayloadArgs = {
  name: string;
  config: Record<string, unknown>;
};

export type IntegrationProviderDefinition = {
  key: string;
  label: string;
  badge: string;
  category: IntegrationCategoryKey;
  description: string;
  mode: IntegrationMode;
  deprecated?: boolean;
  vapiProvider?: string;
  fields: IntegrationFieldDefinition[];
  buildVapiCredentialPayload?: (args: BuildPayloadArgs) => Record<string, unknown>;
};

const azureRegions: IntegrationFieldOption[] = [
  "australia",
  "canadaeast",
  "canadacentral",
  "eastus2",
  "eastus",
  "france",
  "germanywestcentral",
  "india",
  "japaneast",
  "japanwest",
  "northcentralus",
  "norway",
  "polandcentral",
  "southcentralus",
  "spaincentral",
  "swedencentral",
  "switzerland",
  "uaenorth",
  "uk",
  "westeurope",
  "westus",
  "westus3",
].map((region) => ({ value: region, label: region }));

const providers: IntegrationProviderDefinition[] = [
  {
    key: "make",
    label: "Make",
    badge: "M",
    category: "tool_providers",
    description: "Automate workflows with Make.com integration webhooks.",
    mode: "vapi_credential",
    vapiProvider: "make",
    fields: [
      { key: "teamId", label: "Team ID", type: "text", required: true, placeholder: "team_123..." },
      { key: "region", label: "Region", type: "text", required: true, placeholder: "us1" },
      { key: "apiKey", label: "API Key", type: "password", required: true, placeholder: "mk_live_..." },
    ],
    buildVapiCredentialPayload: ({ name, config }) => ({
      provider: "make",
      teamId: requiredString(config, "teamId", "Team ID"),
      region: requiredString(config, "region", "Region"),
      apiKey: requiredString(config, "apiKey", "API Key"),
      name,
    }),
  },
  {
    key: "gohighlevel",
    label: "GoHighLevel",
    badge: "G",
    category: "tool_providers",
    description: "CRM and marketing automation platform integration.",
    mode: "vapi_credential",
    vapiProvider: "gohighlevel",
    fields: [
      { key: "apiKey", label: "API Key", type: "password", required: true, placeholder: "ghl_live_..." },
    ],
    buildVapiCredentialPayload: ({ name, config }) => ({
      provider: "gohighlevel",
      apiKey: requiredString(config, "apiKey", "API Key"),
      name,
    }),
  },
  {
    key: "slack",
    label: "Slack",
    badge: "S",
    category: "tool_providers",
    description: "Send messages and notifications to Slack channels.",
    mode: "vapi_credential",
    vapiProvider: "slack.oauth2-authorization",
    fields: [
      {
        key: "authorizationId",
        label: "Authorization ID",
        type: "text",
        required: true,
        placeholder: "auth_...",
      },
    ],
    buildVapiCredentialPayload: ({ name, config }) => ({
      provider: "slack.oauth2-authorization",
      authorizationId: requiredString(config, "authorizationId", "Authorization ID"),
      name,
    }),
  },
  {
    key: "google_calendar",
    label: "Google Calendar",
    badge: "G",
    category: "tool_providers",
    description: "Manage calendar events and schedule appointments.",
    mode: "vapi_credential",
    vapiProvider: "google.calendar.oauth2-authorization",
    fields: [
      {
        key: "authorizationId",
        label: "Authorization ID",
        type: "text",
        required: true,
        placeholder: "auth_...",
      },
    ],
    buildVapiCredentialPayload: ({ name, config }) => ({
      provider: "google.calendar.oauth2-authorization",
      authorizationId: requiredString(config, "authorizationId", "Authorization ID"),
      name,
    }),
  },
  {
    key: "google_sheets",
    label: "Google Sheets",
    badge: "G",
    category: "tool_providers",
    description: "Read and write data to Google Sheets spreadsheets.",
    mode: "vapi_credential",
    vapiProvider: "google.sheets.oauth2-authorization",
    fields: [
      {
        key: "authorizationId",
        label: "Authorization ID",
        type: "text",
        required: true,
        placeholder: "auth_...",
      },
    ],
    buildVapiCredentialPayload: ({ name, config }) => ({
      provider: "google.sheets.oauth2-authorization",
      authorizationId: requiredString(config, "authorizationId", "Authorization ID"),
      name,
    }),
  },
  {
    key: "gohighlevel_mcp",
    label: "GoHighLevel MCP",
    badge: "G",
    category: "tool_providers",
    description: "Advanced GoHighLevel integration with MCP protocol.",
    mode: "vapi_credential",
    vapiProvider: "ghl.oauth2-authorization",
    fields: [
      {
        key: "authenticationSession",
        label: "Authentication Session (JSON)",
        type: "json",
        required: true,
        placeholder: '{\n  "accessToken": "...",\n  "refreshToken": "...",\n  "expiresAt": "2026-12-31T00:00:00.000Z"\n}',
      },
    ],
    buildVapiCredentialPayload: ({ name, config }) => ({
      provider: "ghl.oauth2-authorization",
      authenticationSession: requiredObject(
        parseJsonMaybe(config.authenticationSession, "Authentication Session"),
        "Authentication Session",
      ),
      name,
    }),
  },
  {
    key: "trieve",
    label: "Trieve (Deprecated)",
    badge: "T",
    category: "vector_store_providers",
    description: "Vector search and semantic retrieval for AI applications.",
    mode: "vapi_credential",
    vapiProvider: "trieve",
    deprecated: true,
    fields: [
      { key: "apiKey", label: "API Key", type: "password", required: true, placeholder: "tr_..." },
    ],
    buildVapiCredentialPayload: ({ name, config }) => ({
      provider: "trieve",
      apiKey: requiredString(config, "apiKey", "API Key"),
      name,
    }),
  },
  {
    key: "sip_trunk",
    label: "SIP Trunk",
    badge: "S",
    category: "phone_number_providers",
    description: "Bring your own SIP trunk or carrier for phone connectivity.",
    mode: "vapi_credential",
    vapiProvider: "byo-sip-trunk",
    fields: [
      {
        key: "gateways",
        label: "Gateways (JSON array)",
        type: "json",
        required: true,
        placeholder: '[{"ip":"203.0.113.12","port":5060}]',
      },
      {
        key: "outboundAuthenticationPlan",
        label: "Outbound Authentication Plan (JSON)",
        type: "json",
        placeholder: '{ "type": "digest", "username": "...", "password": "..." }',
      },
      {
        key: "outboundLeadingPlusEnabled",
        label: "Outbound Leading Plus Enabled",
        type: "boolean",
        defaultValue: false,
      },
      { key: "techPrefix", label: "Tech Prefix", type: "text", placeholder: "9" },
      { key: "sipDiversionHeader", label: "SIP Diversion Header", type: "text", placeholder: "Diversion" },
      {
        key: "sbcConfiguration",
        label: "SBC Configuration (JSON)",
        type: "json",
        placeholder: '{ "host": "sbc.example.com" }',
      },
    ],
    buildVapiCredentialPayload: ({ name, config }) => {
      const payload: Record<string, unknown> = {
        provider: "byo-sip-trunk",
        gateways: requiredArray(parseJsonMaybe(config.gateways, "Gateways"), "Gateways"),
        name,
      };

      assignIfDefined(
        payload,
        "outboundAuthenticationPlan",
        parseJsonMaybe(config.outboundAuthenticationPlan, "Outbound Authentication Plan"),
      );
      assignIfDefined(
        payload,
        "outboundLeadingPlusEnabled",
        optionalBoolean(config.outboundLeadingPlusEnabled),
      );
      assignIfDefined(payload, "techPrefix", optionalString(config.techPrefix));
      assignIfDefined(payload, "sipDiversionHeader", optionalString(config.sipDiversionHeader));
      assignIfDefined(payload, "sbcConfiguration", parseJsonMaybe(config.sbcConfiguration, "SBC Configuration"));
      return payload;
    },
  },
  {
    key: "telnyx",
    label: "Telnyx",
    badge: "T",
    category: "phone_number_providers",
    description: "Global phone numbers with reliable voice infrastructure.",
    mode: "local_config",
    fields: [
      { key: "apiKey", label: "API Key", type: "password", required: true, placeholder: "KEY..." },
      { key: "connectionId", label: "Connection ID", type: "text", placeholder: "123456789" },
      { key: "applicationId", label: "Application ID", type: "text", placeholder: "app_..." },
    ],
  },
  {
    key: "vonage",
    label: "Vonage",
    badge: "V",
    category: "phone_number_providers",
    description: "International phone numbers and communications API.",
    mode: "vapi_credential",
    vapiProvider: "vonage",
    fields: [
      { key: "apiKey", label: "API Key", type: "text", required: true, placeholder: "abcd1234" },
      { key: "apiSecret", label: "API Secret", type: "password", required: true, placeholder: "********" },
    ],
    buildVapiCredentialPayload: ({ name, config }) => ({
      provider: "vonage",
      apiKey: requiredString(config, "apiKey", "API Key"),
      apiSecret: requiredString(config, "apiSecret", "API Secret"),
      name,
    }),
  },
  {
    key: "aws_s3",
    label: "AWS S3",
    badge: "A",
    category: "cloud_providers",
    description: "Scalable cloud storage for recordings and artifacts.",
    mode: "vapi_credential",
    vapiProvider: "s3",
    fields: [
      {
        key: "awsAccessKeyId",
        label: "AWS Access Key ID",
        type: "text",
        required: true,
        placeholder: "AKIA...",
      },
      {
        key: "awsSecretAccessKey",
        label: "AWS Secret Access Key",
        type: "password",
        required: true,
        placeholder: "********",
      },
      { key: "region", label: "Region", type: "text", required: true, placeholder: "us-east-1" },
      { key: "s3BucketName", label: "Bucket Name", type: "text", required: true, placeholder: "eburon-recordings" },
      { key: "s3PathPrefix", label: "Path Prefix", type: "text", required: true, defaultValue: "recordings/" },
      { key: "fallbackIndex", label: "Fallback Index", type: "number", placeholder: "0" },
    ],
    buildVapiCredentialPayload: ({ name, config }) => {
      const payload: Record<string, unknown> = {
        provider: "s3",
        awsAccessKeyId: requiredString(config, "awsAccessKeyId", "AWS Access Key ID"),
        awsSecretAccessKey: requiredString(config, "awsSecretAccessKey", "AWS Secret Access Key"),
        region: requiredString(config, "region", "Region"),
        s3BucketName: requiredString(config, "s3BucketName", "Bucket Name"),
        s3PathPrefix: requiredString(config, "s3PathPrefix", "Path Prefix"),
        name,
      };
      assignIfDefined(payload, "fallbackIndex", optionalNumber(config.fallbackIndex));
      return payload;
    },
  },
  {
    key: "aws_s3_sts",
    label: "AWS S3 (STS)",
    badge: "A",
    category: "cloud_providers",
    description: "Secure S3 storage using IAM role assumption - no static credentials required.",
    mode: "local_config",
    fields: [
      { key: "roleArn", label: "Role ARN", type: "text", required: true, placeholder: "arn:aws:iam::123456789012:role/VapiUploadRole" },
      { key: "externalId", label: "External ID", type: "text", placeholder: "optional-external-id" },
      { key: "region", label: "Region", type: "text", required: true, placeholder: "us-east-1" },
      { key: "bucketName", label: "Bucket Name", type: "text", required: true, placeholder: "eburon-recordings" },
      { key: "pathPrefix", label: "Path Prefix", type: "text", defaultValue: "recordings/" },
    ],
  },
  {
    key: "azure_blob_storage",
    label: "Azure Blob Storage",
    badge: "A",
    category: "cloud_providers",
    description: "Enterprise cloud storage by Microsoft Azure.",
    mode: "vapi_credential",
    vapiProvider: "azure",
    fields: [
      {
        key: "service",
        label: "Service",
        type: "select",
        required: true,
        defaultValue: "blob_storage",
        options: [
          { value: "blob_storage", label: "blob_storage" },
          { value: "speech", label: "speech" },
        ],
      },
      {
        key: "region",
        label: "Region",
        type: "select",
        options: azureRegions,
        placeholder: "Select region",
      },
      { key: "apiKey", label: "API Key", type: "password", placeholder: "********" },
      {
        key: "bucketPlan",
        label: "Bucket Plan (JSON)",
        type: "json",
        placeholder: '{ "containerName": "vapi-artifacts", "path": "/recordings" }',
      },
      { key: "fallbackIndex", label: "Fallback Index", type: "number", placeholder: "0" },
    ],
    buildVapiCredentialPayload: ({ name, config }) => {
      const payload: Record<string, unknown> = {
        provider: "azure",
        service: requiredString(config, "service", "Service"),
        name,
      };
      assignIfDefined(payload, "region", optionalString(config.region));
      assignIfDefined(payload, "apiKey", optionalString(config.apiKey));
      assignIfDefined(payload, "bucketPlan", parseJsonMaybe(config.bucketPlan, "Bucket Plan"));
      assignIfDefined(payload, "fallbackIndex", optionalNumber(config.fallbackIndex));
      return payload;
    },
  },
  {
    key: "google_cloud_storage",
    label: "Google Cloud Storage",
    badge: "G",
    category: "cloud_providers",
    description: "Reliable object storage with global edge network.",
    mode: "vapi_credential",
    vapiProvider: "gcp",
    fields: [
      {
        key: "gcpKey",
        label: "GCP Key (JSON)",
        type: "json",
        required: true,
        placeholder: '{ "type": "service_account", "project_id": "..." }',
      },
      { key: "region", label: "Region", type: "text", placeholder: "us-central1" },
      {
        key: "bucketPlan",
        label: "Bucket Plan (JSON)",
        type: "json",
        placeholder: '{ "bucketName": "my-bucket", "path": "/recordings" }',
      },
      { key: "fallbackIndex", label: "Fallback Index", type: "number", placeholder: "0" },
    ],
    buildVapiCredentialPayload: ({ name, config }) => {
      const payload: Record<string, unknown> = {
        provider: "gcp",
        gcpKey: requiredObject(parseJsonMaybe(config.gcpKey, "GCP Key"), "GCP Key"),
        name,
      };
      assignIfDefined(payload, "region", optionalString(config.region));
      assignIfDefined(payload, "bucketPlan", parseJsonMaybe(config.bucketPlan, "Bucket Plan"));
      assignIfDefined(payload, "fallbackIndex", optionalNumber(config.fallbackIndex));
      return payload;
    },
  },
  {
    key: "cloudflare_r2",
    label: "Cloudflare R2",
    badge: "C",
    category: "cloud_providers",
    description: "Zero-egress cloud storage with global distribution.",
    mode: "vapi_credential",
    vapiProvider: "cloudflare",
    fields: [
      { key: "accountId", label: "Account ID", type: "text", required: true, placeholder: "f82c..." },
      { key: "apiKey", label: "API Key", type: "password", required: true, placeholder: "********" },
      { key: "accountEmail", label: "Account Email", type: "text", required: true, placeholder: "ops@example.com" },
      {
        key: "bucketPlan",
        label: "Bucket Plan (JSON)",
        type: "json",
        placeholder: '{ "bucketName": "vapi-r2", "path": "/recordings" }',
      },
      { key: "fallbackIndex", label: "Fallback Index", type: "number", placeholder: "0" },
    ],
    buildVapiCredentialPayload: ({ name, config }) => {
      const payload: Record<string, unknown> = {
        provider: "cloudflare",
        accountId: requiredString(config, "accountId", "Account ID"),
        apiKey: requiredString(config, "apiKey", "API Key"),
        accountEmail: requiredString(config, "accountEmail", "Account Email"),
        name,
      };
      assignIfDefined(payload, "bucketPlan", parseJsonMaybe(config.bucketPlan, "Bucket Plan"));
      assignIfDefined(payload, "fallbackIndex", optionalNumber(config.fallbackIndex));
      return payload;
    },
  },
  {
    key: "supabase",
    label: "Supabase",
    badge: "S",
    category: "cloud_providers",
    description: "Open-source cloud storage with built-in authentication.",
    mode: "vapi_credential",
    vapiProvider: "supabase",
    fields: [
      {
        key: "bucketPlan",
        label: "Bucket Plan (JSON)",
        type: "json",
        placeholder: '{ "bucketName": "crm-assets", "path": "/recordings" }',
      },
      { key: "fallbackIndex", label: "Fallback Index", type: "number", placeholder: "0" },
    ],
    buildVapiCredentialPayload: ({ name, config }) => {
      const payload: Record<string, unknown> = {
        provider: "supabase",
        name,
      };
      assignIfDefined(payload, "bucketPlan", parseJsonMaybe(config.bucketPlan, "Bucket Plan"));
      assignIfDefined(payload, "fallbackIndex", optionalNumber(config.fallbackIndex));
      return payload;
    },
  },
  {
    key: "langfuse",
    label: "Langfuse",
    badge: "L",
    category: "observability_providers",
    description: "LLM observability, tracing, and analytics platform.",
    mode: "vapi_credential",
    vapiProvider: "langfuse",
    fields: [
      { key: "publicKey", label: "Public Key", type: "text", required: true, placeholder: "pk-lf-..." },
      { key: "apiKey", label: "Secret Key", type: "password", required: true, placeholder: "sk-lf-..." },
      { key: "apiUrl", label: "Host URL", type: "text", required: true, placeholder: "https://cloud.langfuse.com" },
    ],
    buildVapiCredentialPayload: ({ name, config }) => ({
      provider: "langfuse",
      publicKey: requiredString(config, "publicKey", "Public Key"),
      apiKey: requiredString(config, "apiKey", "Secret Key"),
      apiUrl: requiredString(config, "apiUrl", "Host URL"),
      name,
    }),
  },
  {
    key: "server_configuration",
    label: "Server Configuration",
    badge: "S",
    category: "server_configuration",
    description: "Configure custom server credentials and authentication.",
    mode: "vapi_credential",
    vapiProvider: "webhook",
    fields: [
      {
        key: "authenticationPlan",
        label: "Authentication Plan (JSON)",
        type: "json",
        required: true,
        placeholder: '{ "type": "bearer", "token": "..." }',
      },
    ],
    buildVapiCredentialPayload: ({ name, config }) => ({
      provider: "webhook",
      authenticationPlan: requiredObject(
        parseJsonMaybe(config.authenticationPlan, "Authentication Plan"),
        "Authentication Plan",
      ),
      name,
    }),
  },
];

const providerByKey = new Map<string, IntegrationProviderDefinition>(providers.map((provider) => [provider.key, provider]));

export type IntegrationProviderCatalogItem = Omit<IntegrationProviderDefinition, "buildVapiCredentialPayload"> & {
  categoryLabel: string;
};

export type IntegrationProviderCategory = {
  key: IntegrationCategoryKey;
  label: string;
  providers: IntegrationProviderCatalogItem[];
};

export type IntegrationRecord = {
  id: string;
  name: string;
  category: IntegrationCategoryKey;
  categoryLabel: string;
  providerKey: string;
  providerLabel: string;
  providerBadge: string;
  description: string;
  mode: IntegrationMode;
  vapiProvider: string | null;
  upstreamCredentialId: string | null;
  status: IntegrationStatus;
  deprecated: boolean;
  config: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export function listProviderCategories(): IntegrationProviderCategory[] {
  return Object.entries(integrationCategoryLabels).map(([key, label]) => {
    const categoryKey = key as IntegrationCategoryKey;
    const categoryProviders = providers
      .filter((provider) => provider.category === categoryKey)
      .map((provider) => ({
        key: provider.key,
        label: provider.label,
        badge: provider.badge,
        category: provider.category,
        categoryLabel: label,
        description: provider.description,
        mode: provider.mode,
        deprecated: Boolean(provider.deprecated),
        vapiProvider: provider.vapiProvider,
        fields: provider.fields,
      }));

    return {
      key: categoryKey,
      label,
      providers: categoryProviders,
    };
  });
}

export function getProviderDefinition(providerKey: string): IntegrationProviderDefinition | undefined {
  return providerByKey.get(providerKey);
}

export function normalizeIntegrationConfig(
  provider: IntegrationProviderDefinition,
  rawConfig: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const field of provider.fields) {
    const rawValue = rawConfig[field.key];
    if (isEmptyInput(rawValue)) {
      if (field.defaultValue !== undefined) {
        normalized[field.key] = field.defaultValue;
      }
      continue;
    }

    switch (field.type) {
      case "text":
      case "password":
      case "select": {
        normalized[field.key] = String(rawValue).trim();
        break;
      }
      case "number": {
        const value = optionalNumber(rawValue);
        if (value !== undefined) {
          normalized[field.key] = value;
        }
        break;
      }
      case "boolean": {
        const value = optionalBoolean(rawValue);
        if (value !== undefined) {
          normalized[field.key] = value;
        }
        break;
      }
      case "json": {
        const value = parseJsonMaybe(rawValue, field.label);
        if (value !== undefined) {
          normalized[field.key] = value;
        }
        break;
      }
      default: {
        exhaustiveFieldTypeCheck(field.type);
      }
    }
  }

  for (const field of provider.fields) {
    if (field.required && normalized[field.key] === undefined) {
      throw badRequest(`${field.label} is required.`);
    }
  }

  return normalized;
}

export function buildVapiCredentialPayload(
  provider: IntegrationProviderDefinition,
  name: string,
  normalizedConfig: Record<string, unknown>,
): Record<string, unknown> {
  if (!provider.buildVapiCredentialPayload) {
    throw badRequest(`${provider.label} does not map to a Vapi credential payload.`);
  }

  const safeName = name.trim();
  if (!safeName) {
    throw badRequest("Integration name is required.");
  }

  return provider.buildVapiCredentialPayload({
    name: safeName,
    config: normalizedConfig,
  });
}

export function serializeIntegrationRecord(integration: Integration): IntegrationRecord {
  const provider = getProviderDefinition(integration.providerKey);
  const category = normalizeCategoryKey(integration.category, provider?.category);
  const safeProviderLabel = provider?.label ?? integration.providerKey;
  const safeDescription = provider?.description ?? "Custom integration";

  return {
    id: integration.id,
    name: integration.name,
    category,
    categoryLabel: integrationCategoryLabels[category],
    providerKey: integration.providerKey,
    providerLabel: safeProviderLabel,
    providerBadge: provider?.badge ?? safeProviderLabel.charAt(0).toUpperCase(),
    description: safeDescription,
    mode: integration.mode,
    vapiProvider: integration.vapiProvider ?? provider?.vapiProvider ?? null,
    upstreamCredentialId: integration.upstreamCredentialId ?? null,
    status: integration.status,
    deprecated: Boolean(provider?.deprecated),
    config: maskConfigForResponse(provider, integration.config),
    createdAt: integration.createdAt.toISOString(),
    updatedAt: integration.updatedAt.toISOString(),
  };
}

export function parseIntegrationStatus(value: string | undefined): IntegrationStatus {
  if (value === "active" || value === "disabled") {
    return value;
  }
  throw badRequest("status must be 'active' or 'disabled'.");
}

function maskConfigForResponse(
  provider: IntegrationProviderDefinition | undefined,
  value: unknown,
): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (!provider) {
    return null;
  }

  const masked: Record<string, unknown> = {};
  for (const field of provider.fields) {
    if (!(field.key in record)) {
      continue;
    }

    const fieldValue = record[field.key];
    if (field.type === "password") {
      masked[field.key] = maskedSecret;
      continue;
    }

    if (field.type === "json") {
      if (fieldValue === undefined || fieldValue === null) {
        continue;
      }
      masked[field.key] = "[configured]";
      continue;
    }

    masked[field.key] = fieldValue;
  }

  return masked;
}

function parseJsonMaybe(value: unknown, label: string): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      throw badRequest(`${label} must be valid JSON.`);
    }
  }

  if (typeof value === "object") {
    return value;
  }

  throw badRequest(`${label} must be a JSON object or array.`);
}

function requiredObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw badRequest(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function requiredArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw badRequest(`${label} must be a JSON array.`);
  }
  return value;
}

function requiredString(config: Record<string, unknown>, key: string, label: string): string {
  const value = optionalString(config[key]);
  if (!value) {
    throw badRequest(`${label} is required.`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  return undefined;
}

function assignIfDefined(
  payload: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  if (value !== undefined) {
    payload[key] = value;
  }
}

function normalizeCategoryKey(
  rawCategory: string,
  fallback: IntegrationCategoryKey | undefined,
): IntegrationCategoryKey {
  if (rawCategory in integrationCategoryLabels) {
    return rawCategory as IntegrationCategoryKey;
  }
  return fallback ?? "tool_providers";
}

function isEmptyInput(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  return typeof value === "string" && value.trim().length === 0;
}

function badRequest(message: string): Error {
  return Object.assign(new Error(message), { status: 400 });
}

function exhaustiveFieldTypeCheck(value: never): never {
  throw badRequest(`Unsupported field type: ${String(value)}`);
}

