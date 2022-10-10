// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0

var envCache: Environment | undefined = undefined;

export enum Environment {
  DEVELOPMENT = 'DEVELOPMENT',
  PRODUCTION = 'PROD',
}

export function detectEnv(): Environment {
  if (envCache === undefined) {
    if (typeof window === 'undefined'
      ? (process?.env?.ENV === 'production')
      : (window.location.hostname.endsWith('matus.io')
        || new URL(window.location.href).searchParams.get('debug') === undefined)) {
      envCache = Environment.PRODUCTION;
    } else {
      envCache = Environment.DEVELOPMENT;
    }
  }
  return envCache;
}

export function isProd(): boolean {
  return detectEnv() === Environment.PRODUCTION;
}
