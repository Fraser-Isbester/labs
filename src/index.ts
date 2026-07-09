import { PROJECTS, ProjectConfig } from './projects';
import { LANDING_HTML } from './landing';

const GITHUB_ORIGIN = 'https://fraser-isbester.github.io';

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Vanity domain: proxy the matching project at root
    const vanityProject = PROJECTS.find(p => p.vanity === url.hostname);
    if (vanityProject) {
      const upstream = `${GITHUB_ORIGIN}/${vanityProject.slug}${path}${url.search}`;
      return proxyUpstream(request, upstream, url, vanityProject);
    }

    // Root → redirect to /labs
    if (path === '/') {
      return Response.redirect(`${url.origin}/labs`, 301);
    }

    // /labs and /labs/ → landing page
    if (path === '/labs' || path === '/labs/') {
      return landingResponse();
    }

    // /labs/<slug> (no trailing slash) → add trailing slash so relative assets resolve
    const slugOnly = path.match(/^\/labs\/([^/]+)$/);
    if (slugOnly) {
      return Response.redirect(`${url.origin}/labs/${slugOnly[1]}/`, 301);
    }

    // /labs/<slug>/...
    const labsPath = path.match(/^\/labs\/([^/]+)(\/.*)?$/);
    if (labsPath) {
      const slug = labsPath[1];
      const rest = labsPath[2] ?? '/';
      const project = PROJECTS.find(p => p.slug === slug);

      if (!project) {
        // Unknown slug → return landing with 404 status
        return landingResponse(404);
      }

      const upstream = `${GITHUB_ORIGIN}/${slug}${rest}${url.search}`;
      return proxyUpstream(request, upstream, url, project);
    }

    // Bare /<slug>/... — some project builds bake in root-absolute asset
    // paths (e.g. /pickleball/assets/x.js) instead of /labs/<slug>/...
    // Proxy these too so those requests don't 404.
    const barePath = path.match(/^\/([^/]+)(\/.*)?$/);
    if (barePath) {
      const project = PROJECTS.find(p => p.slug === barePath[1]);
      if (project) {
        const rest = barePath[2] ?? '/';
        const upstream = `${GITHUB_ORIGIN}/${project.slug}${rest}${url.search}`;
        return proxyUpstream(request, upstream, url, project);
      }
    }

    return landingResponse(404);
  },
};

function landingResponse(status = 200): Response {
  return new Response(LANDING_HTML, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function proxyUpstream(
  request: Request,
  upstreamUrl: string,
  originalUrl: URL,
  project: ProjectConfig,
): Promise<Response> {
  const upstreamReq = new Request(upstreamUrl, {
    method: request.method,
    headers: buildHeaders(request),
    body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
    redirect: 'manual',
  });

  const response = await fetch(upstreamReq);

  // SPA fallback: serve the project's index.html for any 404 on non-asset paths
  if (response.status === 404 && project.spa) {
    const indexUrl = `${GITHUB_ORIGIN}/${project.slug}/index.html`;
    const indexResp = await fetch(indexUrl);
    const h = new Headers(indexResp.headers);
    h.delete('x-frame-options');
    return new Response(indexResp.body, { status: 200, headers: h });
  }

  const headers = new Headers(response.headers);

  // Rewrite Location headers so redirects from GitHub stay on our domain
  const location = response.headers.get('Location');
  if (location) {
    try {
      const loc = new URL(location, 'https://fraser-isbester.github.io');
      if (loc.hostname === 'fraser-isbester.github.io') {
        headers.set('Location', `${originalUrl.origin}/labs${loc.pathname}${loc.search}`);
      }
    } catch {
      // leave relative locations unchanged
    }
  }

  // Remove headers that would prevent embedding or cause issues behind the proxy
  headers.delete('x-frame-options');
  headers.delete('content-security-policy');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function buildHeaders(request: Request): Headers {
  const h = new Headers(request.headers);
  // Tell GitHub Pages which site to serve
  h.set('Host', 'fraser-isbester.github.io');
  // Strip Cloudflare-added headers that could leak internal info
  for (const key of ['cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor', 'x-forwarded-for']) {
    h.delete(key);
  }
  return h;
}
