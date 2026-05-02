import test from 'node:test';
import assert from 'node:assert/strict';
import { getRuntimeFeatures } from '@/lib/server/runtime-features';

const ENV_KEYS = [
  'VERCEL',
  'VERCEL_ENV',
  'CF_PAGES',
  'CF_PAGES_URL',
  'CLOUDFLARE_ACCOUNT_ID',
  'CF_ACCOUNT_ID',
  'WORKERS_CI',
  'KVIDEO_MEDIA_PROXY_MODE',
  'KVIDEO_MEDIA_PROXY_ENABLED',
] as const;

function withRuntimeEnv(env: Record<string, string | undefined>, callback: () => void): void {
  const previous = new Map<string, string | undefined>();

  for (const key of ENV_KEYS) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    callback();
  } finally {
    for (const key of ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('managed deployments disable media proxy by default', () => {
  withRuntimeEnv({ VERCEL: '1' }, () => {
    const features = getRuntimeFeatures();

    assert.equal(features.deploymentProvider, 'vercel');
    assert.equal(features.restrictedManagedDeployment, true);
    assert.equal(features.mediaProxyEnabled, false);
    assert.equal(features.iptvEnabled, false);
    assert.match(features.restrictionSummary ?? '', /KVIDEO_MEDIA_PROXY_MODE=enabled/);
  });
});

test('managed deployments can explicitly enable media proxy for Safari compatibility', () => {
  withRuntimeEnv({
    CF_PAGES: '1',
    KVIDEO_MEDIA_PROXY_MODE: 'enabled',
  }, () => {
    const features = getRuntimeFeatures();

    assert.equal(features.deploymentProvider, 'cloudflare');
    assert.equal(features.restrictedManagedDeployment, true);
    assert.equal(features.mediaProxyEnabled, true);
    assert.equal(features.iptvEnabled, false);
    assert.match(features.restrictionSummary ?? '', /KVIDEO_PUBLIC_RELAY_ENABLED=true/);
  });
});

test('self-hosted deployments can explicitly disable media proxy', () => {
  withRuntimeEnv({ KVIDEO_MEDIA_PROXY_MODE: 'disabled' }, () => {
    const features = getRuntimeFeatures();

    assert.equal(features.deploymentProvider, 'self-hosted');
    assert.equal(features.restrictedManagedDeployment, false);
    assert.equal(features.mediaProxyEnabled, false);
    assert.equal(features.iptvEnabled, true);
    assert.ok(features.restrictionSummary);
  });
});

test('media proxy mode takes precedence over legacy boolean alias', () => {
  withRuntimeEnv({
    VERCEL: '1',
    KVIDEO_MEDIA_PROXY_MODE: 'disabled',
    KVIDEO_MEDIA_PROXY_ENABLED: 'true',
  }, () => {
    const features = getRuntimeFeatures();

    assert.equal(features.mediaProxyEnabled, false);
  });
});
