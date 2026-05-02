import 'server-only';

import type { RuntimeFeatures } from '@/lib/config/runtime-features';

function isVercelDeployment(): boolean {
  return process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
}

function isCloudflareDeployment(): boolean {
  return (
    process.env.CF_PAGES === '1' ||
    Boolean(process.env.CF_PAGES_URL) ||
    Boolean(process.env.CLOUDFLARE_ACCOUNT_ID) ||
    Boolean(process.env.CF_ACCOUNT_ID) ||
    Boolean(process.env.WORKERS_CI)
  );
}

function normalizeToggle(value: string | undefined): boolean | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;

  if (['1', 'true', 'yes', 'on', 'enabled', 'enable'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off', 'disabled', 'disable'].includes(normalized)) {
    return false;
  }

  return null;
}

function getMediaProxyOverride(): boolean | null {
  const explicitMode = normalizeToggle(process.env.KVIDEO_MEDIA_PROXY_MODE);
  if (explicitMode !== null) return explicitMode;

  return normalizeToggle(process.env.KVIDEO_MEDIA_PROXY_ENABLED);
}

function getRestrictedFeatures(
  deploymentProvider: RuntimeFeatures['deploymentProvider'],
  deploymentProviderLabel: string
): RuntimeFeatures {
  const mediaProxyEnabled = getMediaProxyOverride() === true;
  const restrictionSummary = mediaProxyEnabled
    ? `${deploymentProviderLabel} 托管部署已通过部署变量显式开启外部媒体代理；IPTV 流中继仍关闭。未启用认证时，公共代理仍需要 KVIDEO_PUBLIC_RELAY_ENABLED=true。`
    : `${deploymentProviderLabel} 托管部署默认关闭外部媒体代理、热链转发和 IPTV 流中继。若只需要修复 iOS/Safari HLS 播放兼容，可设置 KVIDEO_MEDIA_PROXY_MODE=enabled，并配置认证或 KVIDEO_PUBLIC_RELAY_ENABLED=true。`;

  return {
    deploymentProvider,
    deploymentProviderLabel,
    restrictedManagedDeployment: true,
    mediaProxyEnabled,
    iptvEnabled: false,
    restrictionSummary,
  };
}

export function getRuntimeFeatures(): RuntimeFeatures {
  const mediaProxyOverride = getMediaProxyOverride();

  if (isVercelDeployment()) {
    return getRestrictedFeatures('vercel', 'Vercel');
  }

  if (isCloudflareDeployment()) {
    return getRestrictedFeatures('cloudflare', 'Cloudflare');
  }

  return {
    deploymentProvider: 'self-hosted',
    deploymentProviderLabel: '自托管',
    restrictedManagedDeployment: false,
    mediaProxyEnabled: mediaProxyOverride !== false,
    iptvEnabled: true,
    restrictionSummary: mediaProxyOverride === false
      ? '外部媒体代理已通过部署变量显式关闭。'
      : null,
  };
}
