/**
 * 5号 房贷站 LendMath —— Cloudflare Workers + Assets
 *
 * ★ 为什么从「纯静态」改成 Workers：
 *   纯静态部署时，Search Console 容易出现「无法抓取 / 类型未知 / 0 个网址」，
 *   问题通常出在 robots.txt / sitemap.xml / ads.txt 三个关键 SEO 文件的
 *   Content-Type 被中间层猜错。
 *
 *   改为 Workers 后，这三个文件由 Worker 层直接返回，
 *   绕过静态资源的 MIME 猜测与任何中间层干扰，
 *   保证 Google 与 AdSense 拿到的永远是正确内容 + 正确 Content-Type。
 *
 * ★ 环境区分（本文件新增）：
 *   生产 = home.saoo.me
 *   测试 = 其它域名（如 ook.5678.us.ci）
 *   测试环境自动：全站 noindex 响应头 + robots 禁抓 + sitemap 返回空。
 *   这样测试站反复部署也不会被 Google 收录、不会与生产站形成重复内容。
 */

/* 生产域名：只有这个域名允许被搜索引擎收录 */
const PROD_HOST = 'home.saoo.me';

function isProdHost(hostname) {
  return hostname === PROD_HOST || hostname === 'www.' + PROD_HOST;
}

/* 非生产环境：给所有响应加 noindex 头 */
function noindexResponse(resp) {
  const headers = new Headers(resp.headers);
  headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
  headers.set('cache-control', 'no-store');
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
}

/* 非生产环境的空 sitemap（测试站不暴露任何 URL） */
function emptySitemap() {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n',
    {
      status: 200,
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': 'no-store',
      },
    }
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const resp = await route(request, env, url);
    // 测试环境一律 noindex
    return isProdHost(url.hostname) ? resp : noindexResponse(resp);
  },
};

async function route(request, env, url) {
    // 统一去掉 www，避免 www 与非 www 双份索引
    if (url.hostname.startsWith('www.')) {
      return Response.redirect(
        'https://' + url.hostname.slice(4) + url.pathname + url.search,
        301
      );
    }

    const pathname = url.pathname;

    /* ★ ads.txt 硬拦截
     * AdSense 抓取器对 Content-Type 极严格，必须是 text/plain，
     * 一旦被猜成 text/html 就判定「ads.txt 无效」，审核卡住。 */
    if (pathname === '/ads.txt') {
      return new Response(
        'google.com, pub-8915931557404979, DIRECT, f08c47fec0942fa0\n',
        {
          status: 200,
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'public, max-age=3600',
          },
        }
      );
    }

    /* ★ robots.txt 硬拦截（含 Mediapartners-Google，AdSense 专用爬虫）
     * 测试环境：全站禁止抓取，彻底不参与任何收录。 */
    if (pathname === '/robots.txt') {
      if (!isProdHost(url.hostname)) {
        return new Response('User-agent: *\nDisallow: /\n', {
          status: 200,
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'no-store',
          },
        });
      }
      return new Response(
        'User-agent: Mediapartners-Google\nAllow: /\n\nUser-agent: *\nAllow: /\n\nSitemap: https://home.saoo.me/sitemap.xml\nSitemap: https://home.saoo.me/sitemap-zh.xml\n',
        {
          status: 200,
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'public, max-age=3600',
          },
        }
      );
    }

    /* ★ sitemap.xml —— 静态文件优先 + 严格校验 + 内联兜底
     * 旧版把 URL 硬编码在这里，加页面时只改 public/sitemap.xml 忘了改这里，
     * 线上就会一直返回旧的硬编码（4号站已实测踩坑：静态96条，线上返回31条
     * 且含已删除页面）。现在改为优先读静态，以后加页面不用再动这里。 */
    const SITEMAP_FALLBACK = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n  <url>\n    <loc>https://home.saoo.me/</loc>\n    <lastmod>2026-10-22</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n  <url>\n    <loc>https://home.saoo.me/guides/</loc>\n    <lastmod>2026-10-22</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>\n  <url>\n    <loc>https://home.saoo.me/guides/mortgage-basics.html</loc>\n    <lastmod>2026-10-22</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://home.saoo.me/guides/mortgage-prepayment.html</loc>\n    <lastmod>2026-10-22</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://home.saoo.me/guides/credit-card-installment-traps.html</loc>\n    <lastmod>2026-10-22</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://home.saoo.me/guides/credit-card-usage-tips.html</loc>\n    <lastmod>2026-10-22</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://home.saoo.me/guides/exchange-rate-basics.html</loc>\n    <lastmod>2026-10-22</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://home.saoo.me/guides/remittance-cost-guide.html</loc>\n    <lastmod>2026-10-22</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://home.saoo.me/about.html</loc>\n    <lastmod>2026-10-22</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n  <url>\n    <loc>https://home.saoo.me/contact.html</loc>\n    <lastmod>2026-10-22</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>\n  <url>\n    <loc>https://home.saoo.me/privacy.html</loc>\n    <lastmod>2026-10-22</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.4</priority>\n  </url>\n  <url>\n    <loc>https://home.saoo.me/terms.html</loc>\n    <lastmod>2026-10-22</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.4</priority>\n  </url>\n  <url>\n    <loc>https://home.saoo.me/disclaimer.html</loc>\n    <lastmod>2026-10-22</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.4</priority>\n  </url>\n</urlset>\n";

    if (pathname === '/sitemap.xml') {
      // 测试环境：返回空 sitemap，不向任何搜索引擎暴露生产站 URL
      if (!isProdHost(url.hostname)) return emptySitemap();
      let body = SITEMAP_FALLBACK;
      try {
        const r = await env.ASSETS.fetch(new Request(url.origin + '/sitemap.xml', request.clone()));
        if (r.status === 200) {
          const t = (await r.text()).trim();
          if (t.startsWith('<?xml') && t.includes('<urlset')) body = t;
        }
      } catch (e) {}
      return new Response(body, { status: 200, headers: {
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': 'public, max-age=3600' } });
    }

    /* ★ sitemap-zh.xml（中文站站点地图）
     * 与 sitemap.xml 同样处理：静态优先 + XML 校验，保证 Content-Type 正确。 */
    if (pathname === '/sitemap-zh.xml') {
      if (!isProdHost(url.hostname)) return emptySitemap();
      try {
        const r2 = await env.ASSETS.fetch(
          new Request(url.origin + '/sitemap-zh.xml', request.clone())
        );
        if (r2.status === 200) {
          const t2 = (await r2.text()).trim();
          if (t2.startsWith('<?xml') && t2.includes('<urlset')) {
            return new Response(t2, {
              status: 200,
              headers: {
                'content-type': 'application/xml; charset=utf-8',
                'cache-control': 'public, max-age=3600',
              },
            });
          }
        }
      } catch (e) {}
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n',
        { status: 200, headers: { 'content-type': 'application/xml; charset=utf-8' } }
      );
    }

    /* 无扩展名路径补 .html（如 /about → /about.html），301 转移权重
     *
     * ⚠️ 只对 GET/HEAD 做：new Request(url, request) 会复用原请求 body 流，
     *    之后再 env.ASSETS.fetch(request) 会抛
     *    "Cannot reconstruct a Request with a used body."
     *    补后缀本身是给页面导航用的，POST 没有必要，直接跳过。 */
    const noExt = !/\.[a-zA-Z0-9]+$/.test(pathname);
    const isNav = request.method === 'GET' || request.method === 'HEAD';
    if (isNav && noExt && pathname !== '/' && !pathname.endsWith('/')) {
      const probe = await env.ASSETS.fetch(
        new Request(url.origin + pathname + '.html', request.clone())
      );
      if (probe.status === 200) {
        return Response.redirect(url.origin + pathname + '.html' + url.search, 301);
      }
    }

    // /guides/ 与 /guides/xxx 补 .html（目录索引 + 文章干净 URL）
    if (isNav && pathname.startsWith('/guides')) {
      const clean = pathname.replace(/\/+$/, '');          // /guides/ → /guides
      const probe = await env.ASSETS.fetch(
        new Request(url.origin + clean + '.html', request.clone())
      );
      if (probe.status === 200) {
        return Response.redirect(url.origin + clean + '.html' + url.search, 301);
      }
      // /guides 或 /guides/ → 索引页
      const idx = await env.ASSETS.fetch(
        new Request(url.origin + '/guides/index.html', request.clone())
      );
      if (idx.status === 200) return idx;
    }

    // /zh/ 与 /zh/guides/ → 中文索引页（目录索引兜底）
    if (isNav && (pathname === '/zh' || pathname === '/zh/')) {
      const zhIdx = await env.ASSETS.fetch(
        new Request(url.origin + '/zh/index.html', request.clone())
      );
      if (zhIdx.status === 200) return zhIdx;
    }
    if (isNav && (pathname === '/zh/guides' || pathname === '/zh/guides/')) {
      const zhGuide = await env.ASSETS.fetch(
        new Request(url.origin + '/zh/guides/index.html', request.clone())
      );
      if (zhGuide.status === 200) return zhGuide;
    }
    if (isNav && pathname.startsWith('/zh/guides')) {
      const clean = pathname.replace(/\/+$/, '');
      const probe = await env.ASSETS.fetch(
        new Request(url.origin + clean + '.html', request.clone())
      );
      if (probe.status === 200) {
        return Response.redirect(url.origin + clean + '.html' + url.search, 301);
      }
    }

    const res = await env.ASSETS.fetch(request);

    // 404 兜底
    if (res.status === 404) {
      return new Response(
        '<!doctype html><meta charset="utf-8"><title>页面不存在</title>' +
          '<div style="font-family:system-ui;max-width:560px;margin:15vh auto;text-align:center">' +
          '<h1 style="font-size:22px">页面不存在</h1>' +
          '<p style="color:#64748b">你访问的页面已移动或从未存在。</p>' +
          '<a href="/" style="color:#2563eb">返回首页</a></div>',
        { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } }
      );
    }

    return res;
}
