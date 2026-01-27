interface EnvVarRule {
  name: string;
  required: boolean;
  requiredWhen?: () => boolean;
  /** Docker alias environment variable names that satisfy the same requirement */
  aliases?: string[];
}

const ENV_RULES: EnvVarRule[] = [
  // Always required - Strapi security keys
  { name: 'APP_KEYS', required: true },
  { name: 'JWT_SECRET', required: true },
  { name: 'ADMIN_JWT_SECRET', required: true },
  { name: 'API_TOKEN_SALT', required: true },
  { name: 'TRANSFER_TOKEN_SALT', required: true },
  { name: 'ENCRYPTION_KEY', required: true },

  // Required when using PostgreSQL (with Docker aliases)
  {
    name: 'DATABASE_HOST',
    required: false,
    requiredWhen: () => isPostgres(),
  },
  {
    name: 'DATABASE_PORT',
    required: false,
    requiredWhen: () => isPostgres(),
  },
  {
    name: 'DATABASE_NAME',
    required: false,
    requiredWhen: () => isPostgres(),
    aliases: ['POSTGRES_DB'],
  },
  {
    name: 'DATABASE_USERNAME',
    required: false,
    requiredWhen: () => isPostgres(),
    aliases: ['POSTGRES_USER'],
  },
  {
    name: 'DATABASE_PASSWORD',
    required: false,
    requiredWhen: () => isPostgres(),
    aliases: ['POSTGRES_PASSWORD'],
  },
];

function isPostgres(): boolean {
  return process.env.DATABASE_CLIENT === 'postgres';
}

/**
 * Checks whether an environment variable (or any of its aliases) is set.
 * Returns true if the primary name OR any alias has a non-empty value.
 */
function isEnvSet(name: string, aliases?: string[]): boolean {
  if (process.env[name]) {
    return true;
  }
  if (aliases) {
    return aliases.some((alias) => !!process.env[alias]);
  }
  return false;
}

/**
 * Validates that all required environment variables are present.
 * Must be called as early as possible in the Strapi lifecycle (register phase).
 * Exits the process with code 1 if any required variables are missing.
 */
export function validateEnv(): void {
  const missing: string[] = [];

  for (const rule of ENV_RULES) {
    const isRequired =
      rule.required || (rule.requiredWhen && rule.requiredWhen());
    if (isRequired && !isEnvSet(rule.name, rule.aliases)) {
      const label = rule.aliases
        ? `${rule.name} (or ${rule.aliases.join(' / ')})`
        : rule.name;
      missing.push(label);
    }
  }

  if (missing.length > 0) {
    const maxLen = Math.max(...missing.map((m) => m.length));
    const boxWidth = Math.max(maxLen + 6, 56);
    const pad = (s: string) => s.padEnd(boxWidth - 2);

    const lines = [
      '',
      `+${'-'.repeat(boxWidth)}+`,
      `| ${pad('MISSING REQUIRED ENVIRONMENT VARIABLES')} |`,
      `+${'-'.repeat(boxWidth)}+`,
      ...missing.map((name) => `|   x ${pad(name).slice(4)} |`),
      `+${'-'.repeat(boxWidth)}+`,
      `| ${pad('Copy .env.example to .env and fill in all values.')} |`,
      `| ${pad('Generate secrets with: openssl rand -base64 32')} |`,
      `+${'-'.repeat(boxWidth)}+`,
      '',
    ];

    console.error(lines.join('\n'));
    process.exit(1);
  }
}
