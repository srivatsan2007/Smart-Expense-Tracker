/**
 * RupeeRise Automated GitHub Release Version Checker
 * Checks repository releases on GitHub and alerts user when a new APK or web update is available.
 */

export const CURRENT_APP_VERSION = '1.0.0';
export const GITHUB_REPO = 'srivatsan2007/Smart-Expense-Tracker';

/**
 * Compare two semver strings (e.g. '1.1.0' > '1.0.0')
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1, v2) {
  const clean1 = (v1 || '').replace(/^[vV]/, '').trim();
  const clean2 = (v2 || '').replace(/^[vV]/, '').trim();

  const parts1 = clean1.split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map(p => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length, 3);
  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Checks GitHub Releases for a newer version than CURRENT_APP_VERSION.
 * Rate-limit friendly: caches checks for 30 minutes unless force=true.
 */
export async function checkGitHubReleaseUpdate(force = false) {
  const CACHE_KEY = 'rupeerise_update_check';
  const DISMISSED_KEY = 'rupeerise_dismissed_version';

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const now = Date.now();

    if (!force && cached) {
      try {
        const parsed = JSON.parse(cached);
        // If checked within 30 minutes, return cached result
        if (now - parsed.timestamp < 30 * 60 * 1000) {
          if (parsed.result && parsed.result.hasUpdate) {
            const dismissed = localStorage.getItem(DISMISSED_KEY);
            if (dismissed === parsed.result.latestVersion) {
              return { hasUpdate: false, dismissed: true };
            }
          }
          return parsed.result;
        }
      } catch (e) {
        // Fall through to live check
      }
    }

    // Fetch latest release from GitHub API
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (res.status === 404) {
      // No release published yet
      const fallbackRes = { hasUpdate: false, reason: 'No releases found on GitHub repository' };
      localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: now, result: fallbackRes }));
      return fallbackRes;
    }

    if (!res.ok) {
      return { hasUpdate: false, error: `GitHub API status ${res.status}` };
    }

    const release = await res.json();
    const tag = release.tag_name || '';
    const cleanTag = tag.replace(/^[vV]/, '');

    const isNewer = compareVersions(cleanTag, CURRENT_APP_VERSION) > 0;

    // Check for APK asset
    let downloadUrl = release.html_url;
    if (Array.isArray(release.assets)) {
      const apkAsset = release.assets.find(a => (a.name || '').toLowerCase().endsWith('.apk'));
      if (apkAsset && apkAsset.browser_download_url) {
        downloadUrl = apkAsset.browser_download_url;
      }
    }

    const checkResult = {
      hasUpdate: isNewer,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: cleanTag,
      releaseTag: tag,
      releaseName: release.name || `RupeeRise Update ${tag}`,
      releaseNotes: release.body || 'New features, bug fixes, and performance improvements.',
      downloadUrl,
      htmlUrl: release.html_url,
      publishedAt: release.published_at,
      hasApk: downloadUrl.endsWith('.apk')
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: now, result: checkResult }));

    if (isNewer) {
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (dismissed === cleanTag && !force) {
        return { ...checkResult, hasUpdate: false, dismissed: true };
      }
    }

    return checkResult;
  } catch (err) {
    console.warn('[UpdateChecker] Could not check GitHub releases:', err.message);
    return { hasUpdate: false, error: err.message };
  }
}

/**
 * Dismiss an update for 24 hours
 */
export function dismissUpdate(version) {
  localStorage.setItem('rupeerise_dismissed_version', version);
}
