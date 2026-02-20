// Centralized environment detection
export function isLocalhost(): boolean {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

export function isProduction(): boolean {
  return !isLocalhost();
}

export function getApiBaseUrl(): string {
  return '';
}

export function getEnvironmentInfo() {
  return {
    isProduction: isProduction(),
    isDevelopment: isLocalhost(),
    apiBaseUrl: getApiBaseUrl(),
    hostname: window.location.hostname,
    nodeEnv: isLocalhost() ? 'development' : 'production'
  };
}