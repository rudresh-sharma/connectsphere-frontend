export interface AppEnvironment {
  production: boolean;
  authApiUrl: string;
  postApiUrl: string;
  followApiUrl: string;
  commentApiUrl: string;
  likeApiUrl: string;
  notificationApiUrl: string;
  notificationWsUrl: string;
  mediaApiUrl: string;
  searchApiUrl: string;
  oauthGoogleUrl: string;
  oauthGithubUrl: string;
  backendApiUrls: string[];
}

type RuntimeEnvironmentOverrides = Partial<
  Omit<AppEnvironment, 'production' | 'backendApiUrls'>
> & {
  gatewayApiUrl?: string;
};

const localDefaults: Omit<AppEnvironment, 'production' | 'backendApiUrls'> = {
  authApiUrl: 'http://localhost:8080',
  postApiUrl: 'http://localhost:8081',
  followApiUrl: 'http://localhost:8082',
  commentApiUrl: 'http://localhost:8083',
  likeApiUrl: 'http://localhost:8084',
  notificationApiUrl: 'http://localhost:8085',
  notificationWsUrl: 'ws://localhost:8085/ws/notifications',
  mediaApiUrl: 'http://localhost:8086',
  searchApiUrl: 'http://localhost:8087',
  oauthGoogleUrl: 'http://localhost:8080/oauth2/authorization/google',
  oauthGithubUrl: 'http://localhost:8080/oauth2/authorization/github'
};

export function buildEnvironment(production: boolean): AppEnvironment {
  const runtimeOverrides = (
    globalThis as typeof globalThis & {
      __CONNECTSPHERE_ENV__?: RuntimeEnvironmentOverrides;
    }
  ).__CONNECTSPHERE_ENV__ ?? {};

  const defaultGatewayApiUrl = production ? null : 'http://localhost:8088';
  const gatewayApiUrl = runtimeOverrides.gatewayApiUrl
    ? normalizeHttpUrl(runtimeOverrides.gatewayApiUrl)
    : defaultGatewayApiUrl;
  const authApiUrl = normalizeHttpUrl(
    runtimeOverrides.authApiUrl ?? gatewayApiUrl ?? localDefaults.authApiUrl
  );
  const postApiUrl = normalizeHttpUrl(
    runtimeOverrides.postApiUrl ?? gatewayApiUrl ?? localDefaults.postApiUrl
  );
  const followApiUrl = normalizeHttpUrl(
    runtimeOverrides.followApiUrl ?? gatewayApiUrl ?? localDefaults.followApiUrl
  );
  const commentApiUrl = normalizeHttpUrl(
    runtimeOverrides.commentApiUrl ?? gatewayApiUrl ?? localDefaults.commentApiUrl
  );
  const likeApiUrl = normalizeHttpUrl(
    runtimeOverrides.likeApiUrl ?? gatewayApiUrl ?? localDefaults.likeApiUrl
  );
  const notificationApiUrl = normalizeHttpUrl(
    runtimeOverrides.notificationApiUrl ?? gatewayApiUrl ?? localDefaults.notificationApiUrl
  );
  const mediaApiUrl = normalizeHttpUrl(
    runtimeOverrides.mediaApiUrl ?? gatewayApiUrl ?? localDefaults.mediaApiUrl
  );
  const searchApiUrl = normalizeHttpUrl(
    runtimeOverrides.searchApiUrl ?? gatewayApiUrl ?? localDefaults.searchApiUrl
  );
  const notificationWsUrl = normalizeSocketUrl(
    runtimeOverrides.notificationWsUrl ??
      (!production && gatewayApiUrl && !runtimeOverrides.notificationApiUrl
        ? localDefaults.notificationWsUrl
        : `${toSocketBase(notificationApiUrl)}/ws/notifications`)
  );

  return {
    production,
    authApiUrl,
    postApiUrl,
    followApiUrl,
    commentApiUrl,
    likeApiUrl,
    notificationApiUrl,
    notificationWsUrl,
    mediaApiUrl,
    searchApiUrl,
    oauthGoogleUrl: normalizeHttpUrl(
      runtimeOverrides.oauthGoogleUrl ?? `${authApiUrl}/oauth2/authorization/google`
    ),
    oauthGithubUrl: normalizeHttpUrl(
      runtimeOverrides.oauthGithubUrl ?? `${authApiUrl}/oauth2/authorization/github`
    ),
    backendApiUrls: [
      authApiUrl,
      postApiUrl,
      followApiUrl,
      commentApiUrl,
      likeApiUrl,
      notificationApiUrl,
      mediaApiUrl,
      searchApiUrl
    ]
  };
}

function normalizeHttpUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function normalizeSocketUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function toSocketBase(url: string): string {
  return url.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
}
