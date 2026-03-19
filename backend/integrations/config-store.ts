type IntegrationProvider = 'glpi' | 'docuware';

type ProviderConfig = {
  enabled: boolean;
  webhook_url: string;
  webhook_token: string;
};

type IntegrationConfigResponse = {
  glpi: ProviderConfig;
  docuware: ProviderConfig;
  inbound_webhook_secret: string;
};

function isTrue(value: string | undefined) {
  return String(value ?? '').toLowerCase() === 'true';
}

function toProviderConfig(provider: IntegrationProvider, row?: any): ProviderConfig {
  const envPrefix = provider.toUpperCase();
  return {
    enabled: row?.enabled ?? isTrue(process.env[`${envPrefix}_ENABLED`]),
    webhook_url: row?.webhookUrl ?? process.env[`${envPrefix}_WEBHOOK_URL`] ?? '',
    webhook_token: row?.webhookToken ?? process.env[`${envPrefix}_WEBHOOK_TOKEN`] ?? '',
  };
}

export async function getIntegrationConfig(db: any): Promise<IntegrationConfigResponse> {
  const rows = await db.integrationSetting.findMany({
    where: {
      provider: {
        in: ['glpi', 'docuware', 'system'],
      },
    },
  });

  const byProvider = Object.fromEntries(rows.map((row: any) => [row.provider, row]));

  return {
    glpi: toProviderConfig('glpi', byProvider.glpi),
    docuware: toProviderConfig('docuware', byProvider.docuware),
    inbound_webhook_secret: byProvider.system?.webhookSecret ?? process.env.INTEGRATIONS_WEBHOOK_SECRET ?? '',
  };
}

export async function saveIntegrationConfig(db: any, input: any): Promise<IntegrationConfigResponse> {
  const glpi = input?.glpi ?? {};
  const docuware = input?.docuware ?? {};

  await Promise.all([
    db.integrationSetting.upsert({
      where: { provider: 'glpi' },
      update: {
        enabled: Boolean(glpi.enabled),
        webhookUrl: String(glpi.webhook_url ?? '').trim(),
        webhookToken: String(glpi.webhook_token ?? '').trim(),
      },
      create: {
        provider: 'glpi',
        enabled: Boolean(glpi.enabled),
        webhookUrl: String(glpi.webhook_url ?? '').trim(),
        webhookToken: String(glpi.webhook_token ?? '').trim(),
      },
    }),
    db.integrationSetting.upsert({
      where: { provider: 'docuware' },
      update: {
        enabled: Boolean(docuware.enabled),
        webhookUrl: String(docuware.webhook_url ?? '').trim(),
        webhookToken: String(docuware.webhook_token ?? '').trim(),
      },
      create: {
        provider: 'docuware',
        enabled: Boolean(docuware.enabled),
        webhookUrl: String(docuware.webhook_url ?? '').trim(),
        webhookToken: String(docuware.webhook_token ?? '').trim(),
      },
    }),
    db.integrationSetting.upsert({
      where: { provider: 'system' },
      update: {
        webhookSecret: String(input?.inbound_webhook_secret ?? '').trim(),
      },
      create: {
        provider: 'system',
        enabled: false,
        webhookSecret: String(input?.inbound_webhook_secret ?? '').trim(),
      },
    }),
  ]);

  await hydrateIntegrationEnvFromDb(db);
  return getIntegrationConfig(db);
}

export async function hydrateIntegrationEnvFromDb(db: any) {
  const config = await getIntegrationConfig(db);

  process.env.GLPI_ENABLED = String(config.glpi.enabled);
  process.env.GLPI_WEBHOOK_URL = config.glpi.webhook_url;
  process.env.GLPI_WEBHOOK_TOKEN = config.glpi.webhook_token;

  process.env.DOCUWARE_ENABLED = String(config.docuware.enabled);
  process.env.DOCUWARE_WEBHOOK_URL = config.docuware.webhook_url;
  process.env.DOCUWARE_WEBHOOK_TOKEN = config.docuware.webhook_token;

  process.env.INTEGRATIONS_WEBHOOK_SECRET = config.inbound_webhook_secret;
}
