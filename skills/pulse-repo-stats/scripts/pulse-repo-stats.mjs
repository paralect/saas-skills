#!/usr/bin/env node
// Generated from apps/web/scripts/pulse-repo-stats/cli.ts by build.ts. Reads GitHub with your
// token, writes one HTML file on this computer, sends nothing anywhere else.

// scripts/pulse-repo-stats/cli.ts
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ../../packages/backend/convex/lib/github.ts
var API = "https://api.github.com";
var GithubError = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
  status;
};
async function request(token, path, init) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 800 * 2 ** (attempt - 1)));
    let res;
    try {
      res = await fetch(`${API}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "pulse-audit",
          ...init?.headers
        }
      });
    } catch (e) {
      lastError = e;
      continue;
    }
    if (res.status >= 500 || res.status === 429) {
      lastError = new GithubError(`GitHub ${res.status}`, res.status);
      continue;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new GithubError(
        res.status === 401 ? "GitHub rejected the token. Check that it is valid and not expired." : `GitHub ${res.status}: ${body.slice(0, 200)}`,
        res.status
      );
    }
    try {
      return await res.json();
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new GithubError("GitHub didn't answer. Try again.", 503);
}
async function graphql(token, query, variables) {
  const res = await request(token, "/graphql", {
    method: "POST",
    body: JSON.stringify({ query, variables })
  });
  if (!res.data) {
    throw new GithubError(res.errors?.[0]?.message ?? "GitHub GraphQL error", 500);
  }
  return res.data;
}
function getViewer(token) {
  return request(token, "/user");
}
async function installedRepos(token) {
  const repos = [];
  const { installations } = await request(token, "/user/installations?per_page=100");
  for (const { id } of installations) {
    for (let page = 1; page <= 5; page++) {
      const batch = await request(
        token,
        `/user/installations/${id}/repositories?per_page=100&page=${page}`
      );
      repos.push(...batch.repositories);
      if (batch.repositories.length < 100) break;
    }
  }
  return repos.sort((a, b) => Date.parse(b.pushed_at ?? "0") - Date.parse(a.pushed_at ?? "0"));
}
async function userRepos(token, since) {
  const repos = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await request(
      token,
      `/user/repos?sort=pushed&direction=desc&per_page=100&page=${page}&affiliation=owner,collaborator,organization_member`
    );
    repos.push(...batch);
    const last = batch.at(-1);
    if (batch.length < 100 || last?.pushed_at && Date.parse(last.pushed_at) < since) break;
  }
  return repos;
}
async function listActiveRepos(token, since, limit, only) {
  const repos = token.startsWith("ghu_") ? await installedRepos(token) : await userRepos(token, since);
  return repos.filter((r) => !only || only.includes(r.full_name)).filter((r) => !r.fork && !r.archived && r.pushed_at && Date.parse(r.pushed_at) >= since).slice(0, limit).map((r) => ({ owner: r.owner.login, name: r.name, fullName: r.full_name }));
}
async function listTargetRepos(token, target, since, limit) {
  const out = [];
  for (const entry of target.split(/[\s,]+/).filter(Boolean).slice(0, 20)) {
    const clean = entry.replace(/^https?:\/\/github\.com\//i, "").replace(/\/+$/, "");
    if (!/^[\w.-]+(\/[\w.-]+)?$/.test(clean)) continue;
    if (clean.includes("/")) {
      out.push(await request(token, `/repos/${clean}`));
      continue;
    }
    const list = await request(token, `/orgs/${clean}/repos?sort=pushed&direction=desc&per_page=100`).catch(
      () => request(token, `/users/${clean}/repos?sort=pushed&direction=desc&per_page=100`)
    );
    out.push(...list);
  }
  return out.filter((r, i, all) => all.findIndex((x) => x.full_name === r.full_name) === i).filter((r) => !r.private).filter((r) => !r.fork && !r.archived && r.pushed_at && Date.parse(r.pushed_at) >= since).sort((a, b) => Date.parse(b.pushed_at) - Date.parse(a.pushed_at)).slice(0, limit).map((r) => ({ owner: r.owner.login, name: r.name, fullName: r.full_name }));
}
var PULL_FIELDS = `
  createdAt mergedAt closedAt isDraft additions deletions baseRefName title bodyText
  author { login avatarUrl(size: 96) __typename }
  reviews(first: 30) { nodes { submittedAt state bodyText author { login avatarUrl(size: 96) __typename } } }
  timelineItems(first: 5, itemTypes: [READY_FOR_REVIEW_EVENT]) {
    nodes {
      __typename
      ... on ReadyForReviewEvent { createdAt }
    }
  }`;
var PULLS_QUERY = `
query($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: 40, after: $cursor, orderBy: { field: CREATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes { ${PULL_FIELDS} }
    }
  }
}`;
var BOT_LOGIN = /\[bot\]$|^dependabot|^renovate|^github-actions/i;
var AGENT_LOGIN = /^(claude|claude\[bot\]|copilot|copilot-swe-agent(\[bot\])?|devin-ai-integration(\[bot\])?|cursor(\[bot\])?|cursoragent|codex|openai-codex|chatgpt-codex-connector(\[bot\])?|google-labs-jules(\[bot\])?|sweep-ai(\[bot\])?|codegen-sh(\[bot\])?)$/i;
var AGENT_BOT = /claude|copilot|codex|devin|cursor|jules|gemini|greptile|coderabbit|sweep|codegen|ellipsis|sourcery|qodo|codium|cubic|bugbot|korbit|bito|openhands|aider|seer-by-sentry|(^|[-_])agents?($|[-_])|(^|[-_])ai($|[-_])|ai$/i;
var AUTOMATION_BOT = /^(dependabot|renovate|github-actions|github-advanced-security|mergify|kodiakhq|sonarcloud|sonarqubecloud|sonarqube|deepsource|codacy|codeclimate|reviewdog|changeset-bot|socket-security|netlify|codecov|snyk|aikido|github-code-quality|nx-cloud|imgbot|allcontributors|pre-commit-ci|release-please|semantic-release|stale|trop|backport)/i;
var botName = (login) => login.replace(/\[bot\]$/i, "");
function isAgent(login, isBotAccount) {
  return AGENT_LOGIN.test(login) || isBotAccount && AGENT_BOT.test(botName(login));
}
function titleShape(title) {
  return title.toLowerCase().replace(/^[\w-]+(\([^)]*\))?!?:\s*/, "").replace(/`[^`]*`/g, " ").replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2).join(" ");
}
function toPullRequest(repo, node) {
  const author = node.author?.login ?? "ghost";
  const createdAt = Date.parse(node.createdAt);
  const ready = node.timelineItems.nodes.find((n) => n.__typename === "ReadyForReviewEvent");
  const submitted = node.reviews.nodes.filter(
    (r) => r.submittedAt && r.state !== "PENDING" && r.author && r.author.login !== author
  );
  const botReview = (r) => r.author.__typename === "Bot" || BOT_LOGIN.test(r.author.login);
  const reviews = submitted.filter((r) => !botReview(r) && !AGENT_LOGIN.test(r.author.login));
  const agentReviewers = /* @__PURE__ */ new Map();
  for (const r of submitted) {
    const bot = botReview(r);
    if (bot ? AUTOMATION_BOT.test(botName(r.author.login)) : !AGENT_LOGIN.test(r.author.login)) continue;
    const app = r.author.__typename === "Bot";
    const login = app ? botName(r.author.login) : r.author.login;
    const bare = r.state === "APPROVED" && r.bodyText.trim() === "";
    const prev = agentReviewers.get(login);
    agentReviewers.set(login, { login, avatar: r.author.avatarUrl, app, approvedOnly: (prev?.approvedOnly ?? true) && bare });
  }
  const authorIsApp = node.author?.__typename === "Bot";
  const botAuthor = authorIsApp || BOT_LOGIN.test(author) || AGENT_LOGIN.test(author);
  const reviewTimes = reviews.map((r) => Date.parse(r.submittedAt)).sort((a, b) => a - b);
  return {
    repo,
    baseRef: node.baseRefName,
    createdAt,
    readyAt: ready?.createdAt ? Date.parse(ready.createdAt) : createdAt,
    mergedAt: node.mergedAt ? Date.parse(node.mergedAt) : null,
    closedAt: node.closedAt ? Date.parse(node.closedAt) : null,
    firstReviewAt: reviewTimes[0] ?? null,
    reviewTimes,
    reviewers: reviews.map((r) => ({ login: r.author.login, avatar: r.author.avatarUrl, at: Date.parse(r.submittedAt) })),
    agentReviewers: [...agentReviewers.values()],
    author: authorIsApp ? botName(author) : author,
    authorAvatar: node.author?.avatarUrl ?? null,
    botAuthor,
    authorIsApp,
    titleShape: titleShape(node.title),
    bodyLength: node.bodyText.length,
    additions: node.additions,
    deletions: node.deletions
  };
}
async function* pullRequestPages(token, repo, since, maxPages) {
  let cursor = null;
  for (let page = 0; page < maxPages; page++) {
    const data = await graphql(token, PULLS_QUERY, { owner: repo.owner, name: repo.name, cursor });
    const conn = data.repository?.pullRequests;
    if (!conn) return;
    const prs = conn.nodes.filter((n) => !n.isDraft || n.mergedAt).map((n) => toPullRequest(repo.fullName, n));
    const inWindow = prs.filter((p) => p.createdAt >= since);
    yield inWindow;
    if (!conn.pageInfo.hasNextPage || inWindow.length < prs.length) return;
    cursor = conn.pageInfo.endCursor;
  }
}
var COMMITS_QUERY = `
query($owner: String!, $name: String!, $since: GitTimestamp!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: 100, since: $since, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes { committedDate author { user { login avatarUrl(size: 96) } name } }
          }
        }
      }
    }
  }
}`;
async function listCommits(token, repo, since, maxPages) {
  const out = [];
  let cursor = null;
  for (let page = 0; page < maxPages; page++) {
    const data = await graphql(token, COMMITS_QUERY, {
      owner: repo.owner,
      name: repo.name,
      since: new Date(since).toISOString(),
      cursor
    });
    const history = data.repository?.defaultBranchRef?.target.history;
    if (!history) break;
    for (const n of history.nodes) {
      const author = n.author?.user?.login ?? n.author?.name ?? "unknown";
      const bot = BOT_LOGIN.test(author) || AGENT_LOGIN.test(author);
      if (bot && AUTOMATION_BOT.test(botName(author))) continue;
      out.push({
        at: Date.parse(n.committedDate),
        author: bot ? botName(author) : author,
        avatar: n.author?.user?.avatarUrl ?? null,
        ...bot ? { bot: true } : {}
      });
    }
    if (!history.pageInfo.hasNextPage) break;
    cursor = history.pageInfo.endCursor;
  }
  return out;
}
var PROD_ENV = /prod|live|release/i;
var NOT_PROD_ENV = /preview|staging|stage|test|dev|e2e/i;
async function productionEnvironments(token, repo) {
  const data = await graphql(
    token,
    `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { environments(first: 100) { nodes { name } } } }`,
    repo
  ).catch(() => null);
  const names = (data?.repository?.environments.nodes ?? []).map((n) => n.name).filter((n) => PROD_ENV.test(n) && !NOT_PROD_ENV.test(n));
  return names.length > 0 ? names.slice(0, 100) : null;
}
var PROD_BRANCH = /^(prod|production|release|releases|live|stable)(\/|$)/i;
var MAX_SHIP_PAGES = 15;
var SEEKABLE_PAGES = 3;
async function readBack(token, repo, since, field, pick, maxPages = MAX_SHIP_PAGES) {
  const out = [];
  let cursor = null;
  let oldest = Date.now();
  for (let page = 0; page < maxPages; page++) {
    const data = await graphql(
      token,
      `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { ${field(cursor)} } }`,
      repo
    );
    const conn = data.repository ? pick(data.repository) : null;
    if (!conn) return { dates: out, coveredFrom: since };
    for (const n of conn.nodes) {
      if (!n.at) continue;
      const at = Date.parse(n.at);
      oldest = Math.min(oldest, at);
      if (n.keep && at >= since) out.push(at);
    }
    if (!conn.pageInfo.hasNextPage || oldest < since) return { dates: out, coveredFrom: since };
    cursor = conn.pageInfo.endCursor;
  }
  return { dates: out, coveredFrom: oldest };
}
var after = (cursor) => cursor ? `, after: "${cursor}"` : "";
function cursorBefore(at) {
  const iso = new Date(at).toISOString().replace(/\.\d{3}Z$/, "Z");
  const bytes = [
    ..."cursor:v2:".split("").map((c) => c.charCodeAt(0)),
    146,
    160 | iso.length,
    ...iso.split("").map((c) => c.charCodeAt(0)),
    // uint64 max id: every item at exactly `at` sorts after it, so the read starts before `at`.
    207,
    ...Array.from({ length: 8 }, () => 255)
  ];
  return btoa(String.fromCharCode(...bytes));
}
async function seekWeeks(token, repo, ends, { field, pick }) {
  const out = [];
  for (let b = 0; b < ends.length; b += 13) {
    const batch = ends.slice(b, b + 13);
    const fields = batch.map((end, i) => `w${i}: ${field.replace("%AFTER%", cursorBefore(end))}`).join("\n");
    const data = await graphql(
      token,
      `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { ${fields} } }`,
      repo
    );
    batch.forEach((end, i) => {
      const hit = pick(data.repository?.[`w${i}`]).filter((n) => n.keep && n.at).map((n) => Date.parse(n.at)).find((t) => t < end && t >= end - 7 * 864e5);
      if (hit !== void 0) out.push(hit);
    });
  }
  return out;
}
async function fillUnread(token, repo, since, read, seek) {
  if (read.coveredFrom <= since) return read;
  const ends = [];
  for (let end = read.coveredFrom; end > since; end -= 7 * 864e5) ends.push(end);
  try {
    const found = await seekWeeks(token, repo, ends, seek);
    return { dates: [...read.dates, ...found], coveredFrom: since };
  } catch {
    return read;
  }
}
async function listShips(token, repo, since) {
  const envs = await productionEnvironments(token, repo);
  const envFilter = envs ? `, environments: ${JSON.stringify(envs)}` : "";
  const safe = (p) => p.catch(() => ({ dates: [], coveredFrom: Date.now() }));
  const [releases, deploys, tags] = await Promise.all([
    safe(readBack(
      token,
      repo,
      since,
      (c) => `releases(first: 100${after(c)}, orderBy: { field: CREATED_AT, direction: DESC }) {
          pageInfo { hasNextPage endCursor } nodes { publishedAt createdAt isDraft isPrerelease } }`,
      (r) => {
        const conn = r.releases;
        return {
          pageInfo: conn.pageInfo,
          nodes: conn.nodes.map((n) => ({ at: n.publishedAt ?? n.createdAt, keep: !n.isDraft && !n.isPrerelease }))
        };
      },
      SEEKABLE_PAGES
    )),
    safe(readBack(
      token,
      repo,
      since,
      (c) => `deployments(first: 100${after(c)}${envFilter}, orderBy: { field: CREATED_AT, direction: DESC }) {
          pageInfo { hasNextPage endCursor } nodes { createdAt environment latestStatus { state } } }`,
      (r) => {
        const conn = r.deployments;
        return {
          pageInfo: conn.pageInfo,
          nodes: conn.nodes.map((n) => ({
            at: n.createdAt,
            keep: PROD_ENV.test(n.environment ?? "") && !NOT_PROD_ENV.test(n.environment ?? "") && n.latestStatus?.state === "SUCCESS"
          }))
        };
      },
      SEEKABLE_PAGES
    )),
    safe(readBack(
      token,
      repo,
      since,
      (c) => `refs(refPrefix: "refs/tags/", first: 100${after(c)}, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
          pageInfo { hasNextPage endCursor }
          nodes { target { ... on Commit { committedDate } ... on Tag { tagger { date } } } } }`,
      (r) => {
        const conn = r.refs;
        if (!conn) return null;
        return {
          pageInfo: conn.pageInfo,
          nodes: conn.nodes.map((n) => ({ at: n.target?.tagger?.date ?? n.target?.committedDate ?? null, keep: true }))
        };
      }
    ))
  ]);
  const releaseNodes = (c) => (c?.nodes ?? []).map((n) => ({ at: n.publishedAt ?? n.createdAt, keep: !n.isDraft && !n.isPrerelease }));
  const deployNodes = (c) => (c?.nodes ?? []).map((n) => ({
    at: n.createdAt,
    keep: PROD_ENV.test(n.environment ?? "") && !NOT_PROD_ENV.test(n.environment ?? "") && n.latestStatus?.state === "SUCCESS"
  }));
  const [allReleases, allDeploys] = await Promise.all([
    fillUnread(token, repo, since, releases, {
      field: `releases(first: 30, after: "%AFTER%", orderBy: { field: CREATED_AT, direction: DESC }) {
        nodes { publishedAt createdAt isDraft isPrerelease } }`,
      pick: releaseNodes
    }),
    fillUnread(token, repo, since, deploys, {
      field: `deployments(first: 30, after: "%AFTER%"${envFilter}, orderBy: { field: CREATED_AT, direction: DESC }) {
        nodes { createdAt environment latestStatus { state } } }`,
      pick: deployNodes
    })
  ]);
  return { releases: allReleases, deploys: allDeploys, tags };
}
async function monthlyCounts(token, repo, months) {
  const history = months.map((m, i) => `c${i}: history(since: "${m.start}", until: "${m.end}") { totalCount }`).join("\n");
  const search = months.map(
    (m, i) => `p${i}: search(type: ISSUE, first: 0, query: "repo:${repo.fullName} is:pr is:merged merged:${m.start.slice(0, 10)}..${m.end.slice(0, 10)} -author:app/dependabot -author:app/renovate -author:app/github-actions") { issueCount }`
  ).join("\n");
  const data = await graphql(
    token,
    `query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        defaultBranchRef { target { ... on Commit { ${history} } } }
      }
      ${search}
    }`,
    { owner: repo.owner, name: repo.name }
  );
  const target = data.repository?.defaultBranchRef?.target ?? {};
  return months.map((m, i) => ({
    month: m.key,
    commits: target[`c${i}`]?.totalCount ?? 0,
    merged: data[`p${i}`]?.issueCount ?? 0
  }));
}
async function dailyCommitCounts(token, repo, days) {
  const out = /* @__PURE__ */ new Map();
  for (let i = 0; i < days.length; i += 61) {
    const batch = days.slice(i, i + 61);
    const fields = batch.map((d, j) => `d${j}: history(since: "${d.start}", until: "${d.end}") { totalCount }`).join("\n");
    const data = await graphql(
      token,
      `query($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) { defaultBranchRef { target { ... on Commit { ${fields} } } } }
      }`,
      repo
    );
    const target = data.repository?.defaultBranchRef?.target ?? {};
    batch.forEach((d, j) => out.set(d.key, target[`d${j}`]?.totalCount ?? 0));
  }
  return out;
}
async function contributorCommits(token, repo, since, historySince) {
  for (let attempt = 0; attempt < 18; attempt++) {
    const res = await fetch(`${API}/repos/${repo.fullName}/stats/contributors`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "pulse-audit"
      }
    });
    if (res.status === 202) {
      await new Promise((r) => setTimeout(r, 2500));
      continue;
    }
    if (!res.ok) return null;
    const stats = await res.json();
    const out = /* @__PURE__ */ new Map();
    for (const s of stats) {
      const a = s.author;
      if (!a) continue;
      const bot = a.type === "Bot" || BOT_LOGIN.test(a.login) || AGENT_LOGIN.test(a.login);
      if (bot && AUTOMATION_BOT.test(botName(a.login))) continue;
      const commits = s.weeks.filter((w) => w.w * 1e3 >= since).reduce((sum, w) => sum + w.c, 0);
      const weeks = s.weeks.filter((w) => w.c > 0 && w.w * 1e3 >= historySince).map((w) => [w.w * 1e3, w.c]);
      if (commits > 0 || weeks.length > 0) {
        out.set(bot ? botName(a.login) : a.login, {
          commits,
          avatar: a.avatar_url,
          weeks,
          ...bot ? { bot: true } : {}
        });
      }
    }
    return out;
  }
  return null;
}
async function personPrCounts(token, fullName, people, sinceDay) {
  const out = /* @__PURE__ */ new Map();
  const safe = people.filter((p) => /^[A-Za-z0-9-]+$/.test(p.login));
  for (let i = 0; i < safe.length; i += 10) {
    const batch = safe.slice(i, i + 10);
    const fields = batch.map((p, j) => {
      const l = p.app ? `app/${p.login}` : p.login;
      return `m${j}: search(type: ISSUE, first: 0, query: "repo:${fullName} is:pr is:merged merged:>=${sinceDay} author:${l}") { issueCount }
           r${j}: search(type: ISSUE, first: 0, query: "repo:${fullName} is:pr is:merged merged:>=${sinceDay} reviewed-by:${l} -author:${l}") { issueCount }`;
    }).join("\n");
    const data = await graphql(token, `query { ${fields} }`, {});
    batch.forEach(
      (p, j) => out.set(p.login, { merged: data[`m${j}`]?.issueCount ?? 0, reviews: data[`r${j}`]?.issueCount ?? 0 })
    );
  }
  return out;
}
var WEEK_SAMPLE = 25;
async function weeklyMergedCounts(token, fullName, weeks) {
  const out = [];
  for (let b = 0; b < weeks.length; b += 2) {
    const batch = weeks.slice(b, b + 2);
    const fields = batch.map(
      (w, i) => `w${i}: search(type: ISSUE, first: ${WEEK_SAMPLE}, query: "repo:${fullName} is:pr is:merged merged:${w.start}..${w.end} -author:app/dependabot -author:app/renovate -author:app/github-actions sort:updated-desc") { issueCount nodes { ... on PullRequest { ${PULL_FIELDS} } } }`
    ).join("\n");
    const data = await graphql(
      token,
      `query { ${fields} }`,
      {}
    );
    batch.forEach((_, i) => {
      const res = data[`w${i}`];
      out.push({
        total: res?.issueCount ?? 0,
        sample: (res?.nodes ?? []).filter((n) => n.mergedAt).map((n) => toPullRequest(fullName, n))
      });
    });
  }
  return out;
}

// ../../packages/backend/convex/lib/metrics.ts
var WINDOW_WEEKS = 12;
var WINDOW_DAYS = WINDOW_WEEKS * 7;
var COMMIT_WEEKS = 26;
var HISTORY_DAYS = COMMIT_WEEKS * 7;
var HISTORY_MONTHS = 6;
var HOUR_MS = 36e5;
var DAY_MS = 864e5;
var AUTOMERGE_MS = 15 * 6e4;
function quantile(values, q) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const next = sorted[base + 1];
  return next !== void 0 ? sorted[base] + (pos - base) * (next - sorted[base]) : sorted[base];
}
var round1 = (n) => n === null ? null : Math.round(n * 10) / 10;
function tzOffset(at, tz) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).formatToParts(at);
    const get = (t) => Number(parts.find((p) => p.type === t)?.value);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - at;
  } catch {
    return 0;
  }
}
function daySpans(now, tz) {
  const fmt = dayKeyFormatter(tz);
  const iso = (t) => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
  const out = [];
  for (let i = COMMIT_WEEKS * 7 - 1; i >= 0; i--) {
    const key = fmt.format(now - i * DAY_MS);
    const [y, m, d] = key.split("-").map(Number);
    const guess = Date.UTC(y, m - 1, d);
    const start = guess - tzOffset(guess, tz);
    out.push({ key, start: iso(start), end: iso(start + DAY_MS - 1e3) });
  }
  return out.filter((d, i, all) => all.findIndex((x) => x.key === d.key) === i);
}
function monthSpans(now) {
  return monthKeys(now).map((key) => {
    const [y, m] = key.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Math.min(Date.UTC(y, m, 1) - 1e3, now));
    return { key, start: start.toISOString().replace(/\.\d{3}Z$/, "Z"), end: end.toISOString().replace(/\.\d{3}Z$/, "Z") };
  });
}
function monthKeys(now) {
  const d = new Date(now);
  return Array.from({ length: HISTORY_MONTHS }, (_, i) => {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (HISTORY_MONTHS - 1 - i), 1));
    return `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}
function topLogins(counts, known, n = 3) {
  return [...counts.entries()].filter(([login]) => known.has(login)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([login]) => login);
}
function dayKeyFormatter(tz) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" });
  }
}
function weekIndex(at, now) {
  const idx = WINDOW_WEEKS - 1 - Math.floor((now - at) / (7 * DAY_MS));
  return idx >= 0 && idx < WINDOW_WEEKS ? idx : null;
}
function weekly(times, now) {
  const out = Array.from({ length: WINDOW_WEEKS }, () => 0);
  for (const t of times) {
    const i = weekIndex(t, now);
    if (i !== null) out[i] += 1;
  }
  return out;
}
function findAgents(prs) {
  const authors = /* @__PURE__ */ new Set();
  const reviewers = /* @__PURE__ */ new Set();
  const byBot = /* @__PURE__ */ new Map();
  for (const p of prs) {
    for (const r of p.agentReviewers) if (!r.approvedOnly) reviewers.add(r.login);
    if (!p.botAuthor || AUTOMATION_BOT.test(p.author)) continue;
    if (isAgent(p.author, true)) authors.add(p.author);
    else byBot.set(p.author, [...byBot.get(p.author) ?? [], p]);
  }
  for (const [login, list] of byBot) {
    if (authors.has(login) || list.length < 3) continue;
    const share = (key) => {
      const counts = /* @__PURE__ */ new Map();
      for (const p of list) counts.set(key(p), (counts.get(key(p)) ?? 0) + 1);
      return Math.max(...counts.values()) / list.length;
    };
    const varied = share((p) => p.titleShape.split(" ")[0] ?? "") <= 0.4 && share((p) => p.titleShape) <= 0.3;
    const written = (quantile(list.map((p) => p.bodyLength), 0.5) ?? 0) >= 700;
    if (varied && written) authors.add(login);
  }
  return { authors, reviewers, all: /* @__PURE__ */ new Set([...authors, ...reviewers]) };
}
var isAgentPr = (p, agents) => p.botAuthor && agents.authors.has(p.author);
var agentReviewed = (p, agents) => p.agentReviewers.some((r) => agents.reviewers.has(r.login));
var notAutomation = (p, agents) => !p.botAuthor || agents.authors.has(p.author);
function scaleSplit({ total, sample: all }, agents) {
  const sample = all.filter((p) => notAutomation(p, agents));
  const counts = { fast: 0, slow: 0, unreviewed: 0 };
  for (const p of sample) {
    if (p.firstReviewAt === null) counts.unreviewed += 1;
    else if (p.firstReviewAt - p.readyAt <= DAY_MS) counts.fast += 1;
    else counts.slow += 1;
  }
  if (sample.length === 0 || total === 0) return { total, fast: 0, slow: 0, unreviewed: 0, agent: 0, agentReviewed: 0 };
  const scale = (n) => Math.round(n / sample.length * total);
  const agent = scale(sample.filter((p) => isAgentPr(p, agents)).length);
  const reviewed = scale(sample.filter((p) => agentReviewed(p, agents)).length);
  const keys = ["fast", "slow", "unreviewed"];
  const exact = keys.map((k) => counts[k] / sample.length * total);
  const parts = exact.map(Math.floor);
  let left = total - parts.reduce((a, n) => a + n, 0);
  for (const i of exact.map((x, i2) => [x - Math.floor(x), i2]).sort((a, b) => b[0] - a[0]).map(([, i2]) => i2)) {
    if (left-- <= 0) break;
    parts[i] += 1;
  }
  return { total, fast: parts[0], slow: parts[1], unreviewed: parts[2], agent, agentReviewed: reviewed };
}
var MAX_PEOPLE = 40;
function computeGithubMetrics(input) {
  return compute(input).metrics;
}
function compute(input) {
  const { now } = input;
  const agents = input.agents ?? findAgents([...input.prs, ...(input.weekSamples ?? []).flat().flatMap((w) => w.sample)]);
  const commits = input.commits.filter((c) => !c.bot || agents.all.has(c.author));
  const authorCommits = input.authorCommits && new Map([...input.authorCommits].filter(([login, a]) => !a.bot || agents.all.has(login)));
  const weekTotals = input.weekSamples ? Array.from(
    { length: WINDOW_WEEKS },
    (_, i) => input.weekSamples.reduce(
      (sum2, repo) => {
        if (!repo[i]) return sum2;
        const w = scaleSplit(repo[i], agents);
        return {
          total: sum2.total + w.total,
          fast: sum2.fast + w.fast,
          slow: sum2.slow + w.slow,
          unreviewed: sum2.unreviewed + w.unreviewed,
          agent: sum2.agent + w.agent,
          agentReviewed: sum2.agentReviewed + w.agentReviewed
        };
      },
      { total: 0, fast: 0, slow: 0, unreviewed: 0, agent: 0, agentReviewed: 0 }
    )
  ) : void 0;
  const allHuman = input.prs.filter((p) => notAutomation(p, agents));
  const allMerged = allHuman.filter((p) => p.mergedAt !== null);
  const human = allHuman.filter((p) => now - p.createdAt <= WINDOW_DAYS * DAY_MS);
  const merged = human.filter((p) => p.mergedAt !== null);
  const reviewWaits = human.filter((p) => p.firstReviewAt !== null).map((p) => Math.max(0, p.firstReviewAt - p.readyAt) / HOUR_MS);
  const mergeTimes = merged.map((p) => ({ ms: p.mergedAt - p.createdAt, reviewed: p.reviewTimes.length > 0 })).filter((m) => !(m.ms < AUTOMERGE_MS && !m.reviewed)).map((m) => m.ms / HOUR_MS);
  const fmt = dayKeyFormatter(input.tz);
  const days = /* @__PURE__ */ new Map();
  const people = /* @__PURE__ */ new Map();
  const apps = /* @__PURE__ */ new Set();
  for (const p of allHuman) {
    if (p.authorIsApp) apps.add(p.author);
    for (const r of p.agentReviewers) if (r.app && agents.reviewers.has(r.login)) apps.add(r.login);
  }
  const person = (login, avatar) => {
    let p = people.get(login);
    if (!p) {
      const agent = agents.all.has(login) || isAgent(login, false);
      p = {
        login,
        avatar,
        commits: 0,
        merged: 0,
        reviews: 0,
        ...agent ? { agent: true } : {},
        ...agent && apps.has(login) ? { app: true } : {}
      };
      people.set(login, p);
    }
    p.avatar ??= avatar;
    return p;
  };
  for (const c of commits) {
    if (now - c.at > COMMIT_WEEKS * 7 * DAY_MS) continue;
    const key = fmt.format(c.at);
    const day = days.get(key) ?? /* @__PURE__ */ new Map();
    day.set(c.author, (day.get(c.author) ?? 0) + 1);
    days.set(key, day);
    if (c.avatar && !authorCommits) person(c.author, c.avatar).commits += 1;
  }
  if (authorCommits) {
    for (const [login, a] of authorCommits) if (a.commits > 0) person(login, a.avatar).commits = a.commits;
  }
  for (const p of merged) person(p.author, p.authorAvatar).merged += 1;
  for (const p of human) {
    const seen = /* @__PURE__ */ new Set();
    for (const r of p.reviewers) {
      if (seen.has(r.login)) continue;
      seen.add(r.login);
      person(r.login, r.avatar).reviews += 1;
    }
  }
  for (const p of human) {
    for (const r of p.agentReviewers) if (agents.reviewers.has(r.login)) person(r.login, r.avatar).reviews += 1;
  }
  for (const [login, c] of input.personPrs ?? []) {
    const p = people.get(login);
    if (p) {
      p.merged = c.merged;
      p.reviews = c.reviews;
    }
  }
  const mergeByAuthor = /* @__PURE__ */ new Map();
  for (const p of merged) {
    const list = mergeByAuthor.get(p.author) ?? [];
    list.push((p.mergedAt - p.createdAt) / HOUR_MS);
    mergeByAuthor.set(p.author, list);
  }
  for (const [login, hours] of mergeByAuthor) {
    const p = people.get(login);
    if (p && hours.length >= 5) p.mergeHours = round1(quantile(hours, 0.5)) ?? void 0;
  }
  const score = (p) => p.merged * 3 + p.reviews * 2 + p.commits;
  const ranked = [
    ...[...people.values()].filter((p) => p.avatar && !p.agent).sort((a, b) => score(b) - score(a)).slice(0, MAX_PEOPLE),
    ...[...people.values()].filter((p) => p.agent && p.commits + p.merged + p.reviews > 0)
  ].sort((a, b) => score(b) - score(a));
  const known = new Set(ranked.map((p) => p.login));
  const monthFmt = (at) => fmt.format(at).slice(0, 7);
  const months = monthKeys(now).map((month) => ({
    month,
    commits: 0,
    merged: 0,
    byCommitter: /* @__PURE__ */ new Map(),
    byMerger: /* @__PURE__ */ new Map()
  }));
  const monthOf = new Map(months.map((m) => [m.month, m]));
  const statsByWeek = authorCommits && [...authorCommits.values()].some((a) => a.weeks?.length);
  for (const c of commits) {
    const m = monthOf.get(monthFmt(c.at));
    if (!m) continue;
    m.commits += 1;
    if (!statsByWeek) m.byCommitter.set(c.author, (m.byCommitter.get(c.author) ?? 0) + 1);
  }
  if (statsByWeek) {
    for (const [login, a] of authorCommits) {
      for (const [weekStart, n] of a.weeks ?? []) {
        const m = monthOf.get(monthFmt(weekStart + 3 * DAY_MS));
        if (m) m.byCommitter.set(login, (m.byCommitter.get(login) ?? 0) + n);
      }
    }
  }
  for (const p of allMerged) {
    const m = monthOf.get(monthFmt(p.mergedAt));
    if (!m) continue;
    m.merged += 1;
    m.byMerger.set(p.author, (m.byMerger.get(p.author) ?? 0) + 1);
  }
  const branchShips = allMerged.filter((p) => PROD_BRANCH.test(p.baseRef)).map((p) => p.mergedAt);
  const sources = [
    ["releases", input.releases],
    ["deploys", input.deploys],
    ["branch", branchShips],
    ["tags", input.tags]
  ];
  const weeksIn = (list) => new Set(list.filter((t) => t <= now && now - t < WINDOW_DAYS * DAY_MS).map((t) => Math.floor((now - t) / (7 * DAY_MS)))).size;
  const pushes = ["push", input.commits.map((c) => c.at)];
  const shipSource = sources.filter(([, list]) => list.length > 0).reduce(
    (best, s) => !best || weeksIn(s[1]) > weeksIn(best[1]) ? s : best,
    void 0
  ) ?? (pushes[1].length > 0 ? pushes : void 0);
  const sampled = weekTotals ?? null;
  const sum = (key) => sampled.reduce((a, w) => a + (w[key] ?? 0), 0);
  const agentPeople = [...people.values()].filter((p) => p.agent);
  const openers = agentPeople.filter((p) => agents.authors.has(p.login));
  const exactOpened = input.personPrs && openers.every((p) => input.personPrs.has(p.login));
  const ai = {
    merged: sampled ? sum("total") : merged.length,
    opened: exactOpened ? openers.reduce((a, p) => a + p.merged, 0) : sampled ? sum("agent") : merged.filter((p) => isAgentPr(p, agents)).length,
    reviewed: sampled ? sum("agentReviewed") : merged.filter((p) => agentReviewed(p, agents)).length,
    commits: agentPeople.reduce((a, p) => a + p.commits, 0)
  };
  const byRepo = /* @__PURE__ */ new Map();
  for (const p of human) byRepo.set(p.repo, (byRepo.get(p.repo) ?? 0) + 1);
  const prSizes = merged.map((p) => p.additions + p.deletions);
  const unreviewed = merged.filter((p) => p.reviewTimes.length === 0).length;
  const metrics = {
    team: input.team,
    reposTotal: input.reposTotal,
    reposDone: input.reposDone,
    repos: [...byRepo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, prs: count })),
    prs: human.length,
    merged: merged.length,
    authors: (/* @__PURE__ */ new Set([...human.map((p) => p.author), ...commits.map((c) => c.author)])).size,
    reviewWaitHours: round1(quantile(reviewWaits, 0.5)),
    reviewWaitSample: reviewWaits.length,
    mergeHours: round1(quantile(mergeTimes, 0.5)),
    mergeSample: mergeTimes.length,
    unreviewedPct: merged.length > 0 ? Math.round(unreviewed / merged.length * 100) : null,
    prSize: quantile(prSizes, 0.5),
    commitDays: [.../* @__PURE__ */ new Set([...days.keys(), ...input.dayTotals?.keys() ?? []])].sort((a, b) => a.localeCompare(b)).map((day) => [day, days.get(day) ?? /* @__PURE__ */ new Map()]).filter(([day, byAuthor]) => (input.dayTotals?.get(day) ?? byAuthor.size) > 0).map(([day, byAuthor]) => [
      day,
      input.dayTotals?.get(day) ?? [...byAuthor.values()].reduce((a, n) => a + n, 0),
      [...byAuthor.entries()].filter(([login]) => known.has(login)).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([login]) => login)
    ]),
    people: ranked,
    commits: input.dayTotals ? [...input.dayTotals.values()].reduce((a, n) => a + n, 0) : commits.length,
    weeklyPrs: Array.from({ length: WINDOW_WEEKS }, (_, i) => {
      const inWeek = merged.filter((p) => weekIndex(p.mergedAt, now) === i);
      const split = {
        fast: 0,
        slow: 0,
        unreviewed: 0,
        agent: inWeek.filter((p) => isAgentPr(p, agents)).length,
        agentReviewed: inWeek.filter((p) => agentReviewed(p, agents)).length
      };
      for (const p of inWeek) {
        if (p.firstReviewAt === null) split.unreviewed += 1;
        else if (p.firstReviewAt - p.readyAt <= 24 * HOUR_MS) split.fast += 1;
        else split.slow += 1;
      }
      const exact = weekTotals?.[i];
      if (exact && exact.fast + exact.slow + exact.unreviewed > 0) return exact;
      return { total: exact?.total ?? inWeek.length, ...split };
    }),
    ai,
    public: input.isPublic ?? false,
    peopleTotal: [...people.values()].filter((p) => !p.agent && (p.commits || p.merged || p.reviews)).length,
    humanCommits: [...people.values()].filter((p) => !p.agent).reduce((a, p) => a + p.commits, 0),
    asOf: now,
    weeklyMerged: weekly(
      merged.map((p) => p.mergedAt),
      now
    ),
    monthly: months.map((m) => ({
      month: m.month,
      commits: input.monthTotals?.get(m.month)?.commits ?? m.commits,
      merged: input.monthTotals?.get(m.month)?.merged ?? m.merged,
      committers: topLogins(m.byCommitter, known),
      mergers: topLogins(m.byMerger, known)
    })),
    // One timestamp per day is enough to say whether a week shipped, and keeps the
    // document small no matter how often a team releases.
    ships: [
      ...new Map(
        (shipSource?.[1] ?? []).filter((t) => now - t <= HISTORY_DAYS * DAY_MS).map((t) => [Math.floor(t / DAY_MS), t])
      ).values()
    ],
    shipsRead: (shipSource?.[1] ?? []).filter((t) => now - t <= HISTORY_DAYS * DAY_MS).length,
    shipSource: shipSource?.[0] ?? null,
    shipsFrom: (() => {
      const key = shipSource?.[0];
      if (!key || key === "branch" || key === "push" || !input.shipCoverage) return null;
      const from = input.shipCoverage[key];
      return from > now - WINDOW_DAYS * DAY_MS ? from : null;
    })()
  };
  return {
    metrics,
    stats: {
      reviewWaits: histogram(reviewWaits),
      mergeTimes: histogram(mergeTimes),
      prSizes: histogram(prSizes),
      unreviewed,
      people: [...people.values()].filter((p) => !p.agent && (p.commits || p.merged || p.reviews)).map((p) => p.login)
    }
  };
}
var BUCKET_LOG = Math.log(1.02);
function histogram(values) {
  const counts = /* @__PURE__ */ new Map();
  for (const x of values) {
    const i = Math.round(Math.log1p(Math.max(0, x)) / BUCKET_LOG);
    counts.set(i, (counts.get(i) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0] - b[0]);
}
function computeRepoPart(repo, input) {
  const { metrics, stats } = compute(input);
  return { repo, metrics, stats };
}

// ../../packages/backend/convex/lib/pipeline.ts
async function readPipeline(token, repo) {
  const data = await graphql(
    token,
    `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { defaultBranchRef { name } } }`,
    { owner: repo.owner, name: repo.name }
  );
  const branch = data.repository?.defaultBranchRef?.name ?? null;
  const [gates, checks] = await Promise.all([
    branch ? readGates(token, repo, branch).catch(() => null) : null,
    branch ? readChecks(token, repo, branch).catch(() => null) : null
  ]);
  return { repo: repo.fullName, gates, checks };
}
async function readGates(token, repo, branch) {
  const path = `/repos/${repo.fullName}`;
  const ref = encodeURIComponent(branch);
  const [info, rules] = await Promise.all([
    request(token, `${path}/branches/${ref}`),
    request(token, `${path}/rules/branches/${ref}?per_page=100`).catch(() => [])
  ]);
  const of = (type) => rules.filter((r) => r.type === type);
  const pr = of("pull_request").map((r) => r.parameters ?? {});
  const any = (key) => pr.some((p) => p[key] === true);
  const checks = new Set(info.protection?.required_status_checks?.contexts ?? []);
  for (const r of of("required_status_checks")) {
    const list = r.parameters?.required_status_checks ?? [];
    for (const c of list) checks.add(c.context);
  }
  const known = /* @__PURE__ */ new Set([
    "pull_request",
    "required_status_checks",
    "non_fast_forward",
    "deletion",
    "required_signatures",
    "required_linear_history",
    "merge_queue",
    "creation",
    "update"
  ]);
  return {
    branch,
    protected: info.protected,
    classic: info.protection?.enabled === true,
    pullRequest: pr.length > 0,
    approvals: pr.length > 0 ? Math.max(...pr.map((p) => Number(p.required_approving_review_count ?? 0))) : null,
    codeOwners: any("require_code_owner_review"),
    lastPushApproval: any("require_last_push_approval"),
    dismissStale: any("dismiss_stale_reviews_on_push"),
    threadResolution: any("required_review_thread_resolution"),
    requiredChecks: [...checks].sort(),
    forcePushBlocked: of("non_fast_forward").length > 0,
    deletionBlocked: of("deletion").length > 0,
    signedCommits: of("required_signatures").length > 0,
    linearHistory: of("required_linear_history").length > 0,
    mergeQueue: of("merge_queue").length > 0,
    otherRules: [...new Set(rules.map((r) => r.type).filter((t) => !known.has(t)))]
  };
}
var PR_PAGES = 2;
var CHECKS_QUERY = `
query($owner: String!, $name: String!, $branch: String!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(states: MERGED, baseRefName: $branch, last: 25, before: $cursor) {
      pageInfo { hasPreviousPage startCursor }
      nodes {
        reviewDecision
        commits(last: 1) { nodes { commit {
          statusCheckRollup { state }
          checkSuites(first: 60) { nodes {
            conclusion
            app { slug name }
            workflowRun { workflow { name url } }
          } }
          status { contexts { context state creator { login } } }
        } } }
      }
    }
  }
}`;
var RAN = /* @__PURE__ */ new Set(["SUCCESS", "FAILURE", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "NEUTRAL", "STARTUP_FAILURE"]);
var FAILED = /* @__PURE__ */ new Set(["FAILURE", "TIMED_OUT", "STARTUP_FAILURE", "ERROR"]);
async function readChecks(token, repo, branch) {
  const out = {
    sampled: 0,
    withChecks: 0,
    mergedRed: 0,
    mergedPending: 0,
    approved: 0,
    bypassed: 0,
    noReviewRule: 0,
    tools: []
  };
  const tools = /* @__PURE__ */ new Map();
  let cursor = null;
  for (let page = 0; page < PR_PAGES; page++) {
    const data = await graphql(token, CHECKS_QUERY, { owner: repo.owner, name: repo.name, branch, cursor });
    const conn = data.repository?.pullRequests;
    if (!conn) break;
    for (const pr of conn.nodes) {
      out.sampled += 1;
      if (pr.reviewDecision === "APPROVED") out.approved += 1;
      else if (pr.reviewDecision === null) out.noReviewRule += 1;
      else out.bypassed += 1;
      const commit = pr.commits.nodes[0]?.commit;
      if (!commit) continue;
      const seen = /* @__PURE__ */ new Map();
      const add = (tool, failed) => {
        const prev = seen.get(tool.name);
        seen.set(tool.name, { tool, failed: failed || Boolean(prev?.failed) });
      };
      for (const s of commit.checkSuites.nodes) {
        if (!s.conclusion || !RAN.has(s.conclusion)) continue;
        const workflow = s.workflowRun?.workflow;
        if (workflow)
          add(
            { name: workflow.name, source: "actions", kind: workflowKind(workflow.name), url: workflow.url },
            FAILED.has(s.conclusion)
          );
        else if (s.app)
          add(
            { name: s.app.name, source: "app", kind: appKind(s.app.slug), url: `https://github.com/apps/${s.app.slug}` },
            FAILED.has(s.conclusion)
          );
      }
      for (const c of commit.status?.contexts ?? []) {
        const creator = c.creator?.login ?? "";
        const bot = /\[bot\]$/i.test(creator) || APP_KIND[botName(creator).toLowerCase()] !== void 0;
        const name = bot ? botName(creator) : (c.context.split(/ [–—-] |[/:]/)[0] ?? c.context).trim();
        const kind = bot ? appKind(botName(creator)) : workflowKind(c.context);
        add(
          { name, source: "status", kind, ...bot && { url: `https://github.com/apps/${botName(creator)}` } },
          FAILED.has(c.state)
        );
      }
      if (seen.size > 0) out.withChecks += 1;
      const state = commit.statusCheckRollup?.state;
      if (state === "FAILURE" || state === "ERROR") out.mergedRed += 1;
      if (state === "PENDING" || state === "EXPECTED") out.mergedPending += 1;
      for (const { tool, failed } of seen.values()) {
        const t = tools.get(tool.name) ?? { ...tool, prs: 0, failed: 0 };
        t.prs += 1;
        if (failed) t.failed += 1;
        tools.set(tool.name, t);
      }
    }
    if (!conn.pageInfo.hasPreviousPage) break;
    cursor = conn.pageInfo.startCursor;
  }
  out.tools = [...tools.values()].sort((a, b) => b.prs - a.prs || a.name.localeCompare(b.name));
  return out;
}
var APP_KIND = {
  vercel: "Preview",
  netlify: "Preview",
  "cloudflare-workers-and-pages": "Preview",
  "railway-app": "Preview",
  render: "Preview",
  "pkg-pr-new": "Preview",
  "codesandbox-ci": "Preview",
  codesandbox: "Preview",
  stackblitz: "Preview",
  coderabbitai: "AI review",
  "copilot-pull-request-reviewer": "AI review",
  claude: "AI review",
  cursor: "AI review",
  "greptile-apps": "AI review",
  "sourcery-ai": "AI review",
  "qodo-merge-pro": "AI review",
  "ellipsis-dev": "AI review",
  "devin-ai-integration": "AI review",
  "chatgpt-codex-connector": "AI review",
  "gemini-code-assist": "AI review",
  "cubic-dev-ai": "AI review",
  codecov: "Coverage",
  coveralls: "Coverage",
  codeclimate: "Coverage",
  "socket-security": "Security",
  snyk: "Security",
  "snyk-io": "Security",
  "github-advanced-security": "Security",
  "github-code-scanning": "Security",
  "stepsecurity-actions-security": "Security",
  sonarcloud: "Security",
  sonarqubecloud: "Security",
  gitguardian: "Security",
  "semgrep-app": "Security",
  "aikido-security": "Security",
  "vercel-security-reviewer": "Security",
  deepsource: "Security",
  codacy: "Security",
  sentry: "Monitoring",
  "datadog-official": "Monitoring",
  "meta-cla": "CLA",
  "cla-assistant": "CLA",
  "cla-checker-service": "CLA",
  "linux-foundation-easycla": "CLA",
  dco: "CLA",
  "changeset-bot": "Release",
  renovate: "Dependencies",
  dependabot: "Dependencies",
  "autofix-ci": "Housekeeping",
  "pre-commit-ci": "Lint & types",
  "nx-cloud": "Build",
  "blacksmith-sh": "Build",
  "azure-pipelines": "Build",
  "circleci-checks": "Build",
  buildkite: "Build",
  "travis-ci": "Build",
  depot: "Build",
  "graphite-app": "Merge queue",
  mergify: "Merge queue",
  kodiakhq: "Merge queue",
  "trunk-io": "Merge queue",
  "chromatic-com": "Visual tests",
  percy: "Visual tests",
  "argos-ci": "Visual tests",
  "lost-pixel-app": "Visual tests",
  checkly: "Tests",
  "meticulous-ai": "Tests",
  "relative-ci": "Performance",
  "codspeed-hq": "Performance",
  bundlemon: "Performance",
  codspeed: "Performance"
};
var appKind = (slug) => APP_KIND[slug.toLowerCase()] ?? workflowKind(slug);
var NAME_KIND = [
  [/label|triage|greet|welcome|stale|notify|discord|slack|assign|cache|cleanup|lock|comment|backport|title|autofix/i, "Housekeeping"],
  [/codeql|security|vuln|audit|scan|snyk|trivy|secret|dependency.review|scorecard|zizmor/i, "Security"],
  [/test|e2e|spec|jest|vitest|playwright|cypress|integration/i, "Tests"],
  [/lint|eslint|prettier|format|biome|typecheck|type.check|types|typescript|tsc|clippy|rustfmt|ruff|mypy|style|knip|reviewdog/i, "Lint & types"],
  [/size|bundle|bench|perf|lighthouse/i, "Performance"],
  [/visual|screenshot|chromatic|percy/i, "Visual tests"],
  [/coverage/i, "Coverage"],
  [/cla\b|dco\b|license/i, "CLA"],
  [/preview|deploy/i, "Preview"],
  [/release|publish|changeset|version/i, "Release"],
  [/build|compile|\bci\b|check|verify|validate/i, "Build"]
];
var workflowKind = (name) => NAME_KIND.find(([re]) => re.test(name))?.[1] ?? "Other";

// ../../packages/backend/convex/lib/read.ts
var MAX_REPOS = 12;
var MAX_PR_PAGES_PER_REPO = 10;
var REPO_CONCURRENCY = 4;
var MAX_COMMIT_PAGES_PER_REPO = 30;
var METRICS_EVERY_MS = 3e3;
var plural = (n, word) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;
async function readGithub({ token, target, picked, repos: named, windowDays, tz, live, report }) {
  const now = Date.now();
  const since = now - windowDays * DAY_MS;
  const historySince = now - HISTORY_DAYS * DAY_MS;
  const viewer = await getViewer(token);
  await report({
    account: target ? target.split(/[\s,]+/).filter(Boolean).slice(0, 2).join(", ") : viewer.login,
    avatarUrl: viewer.avatar_url,
    activity: "Finding repositories with recent work…",
    progress: 0.06
  });
  const repos = named ?? (target ? await listTargetRepos(token, target, since, MAX_REPOS) : await listActiveRepos(token, since, MAX_REPOS, picked));
  if (repos.length === 0) {
    throw new Error(target ? `No active repos found for "${target}" in the last ${WINDOW_WEEKS} weeks.` : `No repos with activity in the last ${WINDOW_WEEKS} weeks.`);
  }
  const owners = /* @__PURE__ */ new Map();
  for (const r of repos) owners.set(r.owner, (owners.get(r.owner) ?? 0) + 1);
  const team = [...owners.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? viewer.login;
  const prs = [];
  const commits = [];
  const releases = [];
  const deploys = [];
  const tags = [];
  const shipCoverage = { releases: historySince, deploys: historySince, tags: historySince };
  const spans = monthSpans(now);
  const days = daySpans(now, tz);
  const weekRanges = Array.from({ length: WINDOW_WEEKS }, (_, i) => {
    const end = now - (WINDOW_WEEKS - 1 - i) * 7 * DAY_MS;
    const day = (t) => new Date(t).toISOString().slice(0, 10);
    return { start: day(end - 7 * DAY_MS + DAY_MS), end: day(end) };
  });
  const weekSamples = [];
  let weekTotalsOk = true;
  const dayTotals = /* @__PURE__ */ new Map();
  const authorCommits = /* @__PURE__ */ new Map();
  let authorStatsOk = true;
  const personPrs = /* @__PURE__ */ new Map();
  const monthTotals = /* @__PURE__ */ new Map();
  const perRepo = /* @__PURE__ */ new Map();
  const metrics = (reposDone2) => computeGithubMetrics({
    prs,
    commits,
    releases,
    deploys,
    tags,
    shipCoverage,
    monthTotals: monthTotals.size > 0 ? monthTotals : void 0,
    dayTotals: dayTotals.size > 0 ? dayTotals : void 0,
    // Only trust exact per-person counts if every repo returned them.
    authorCommits: authorStatsOk && authorCommits.size > 0 ? authorCommits : void 0,
    personPrs: personPrs.size > 0 ? personPrs : void 0,
    // Exact weekly counts only if every finished repo returned them; else the sample.
    weekSamples: reposDone2 > 0 && weekTotalsOk ? weekSamples : void 0,
    isPublic: Boolean(target),
    team,
    reposTotal: repos.length,
    reposDone: reposDone2,
    now,
    tz
  });
  let metricsAt = Date.now();
  await report({ scope: plural(repos.length, "repo"), progress: 0.08 }, live ? metrics(0) : void 0);
  let reposDone = 0;
  let totalRead = 0;
  let chain = Promise.resolve();
  const publish = (activity) => {
    chain = chain.then(() => {
      const due = live && Date.now() - metricsAt >= METRICS_EVERY_MS;
      if (due) metricsAt = Date.now();
      return report(
        {
          ...activity ? { activity } : {},
          progress: 0.08 + 0.9 * Math.min(repos.length, reposDone + 0.5) / repos.length
        },
        due ? metrics(reposDone) : void 0
      );
    });
    return chain;
  };
  const queue = [...repos];
  const worker = async () => {
    for (let repo = queue.shift(); repo; repo = queue.shift()) {
      const [ships, repoCommits, counts, perWeek, perDay, perAuthor] = await Promise.all([
        listShips(token, repo, historySince).catch(() => {
          const none = { dates: [], coveredFrom: historySince };
          return { releases: none, deploys: none, tags: none };
        }),
        listCommits(token, repo, now - COMMIT_WEEKS * 7 * DAY_MS, MAX_COMMIT_PAGES_PER_REPO).catch(
          () => []
        ),
        monthlyCounts(token, repo, spans).catch(() => null),
        weeklyMergedCounts(token, repo.fullName, weekRanges).catch(() => null),
        dailyCommitCounts(token, repo, days).catch(() => null),
        contributorCommits(token, repo, since, historySince).catch(() => null),
        (async () => {
          for await (const page of pullRequestPages(token, repo, historySince, MAX_PR_PAGES_PER_REPO)) {
            prs.push(...page);
            totalRead += page.length;
            await publish(`Reading ${repo.fullName} · ${plural(totalRead, "pull request")} so far`);
          }
        })()
      ]);
      commits.push(...repoCommits);
      perRepo.set(repo.fullName, {
        commits: repoCommits,
        releases: ships.releases.dates,
        deploys: ships.deploys.dates,
        tags: ships.tags.dates,
        shipCoverage: {
          releases: Math.max(historySince, ships.releases.coveredFrom),
          deploys: Math.max(historySince, ships.deploys.coveredFrom),
          tags: Math.max(historySince, ships.tags.coveredFrom)
        },
        monthTotals: counts ? new Map(counts.map((c) => [c.month, { commits: c.commits, merged: c.merged }])) : void 0,
        dayTotals: perDay && perDay.size > 0 ? perDay : void 0,
        authorCommits: perAuthor && perAuthor.size > 0 ? perAuthor : void 0,
        weekSamples: perWeek ? [perWeek] : void 0
      });
      for (const [day, n] of perDay ?? []) dayTotals.set(day, (dayTotals.get(day) ?? 0) + n);
      if (!perWeek) weekTotalsOk = false;
      if (perWeek) weekSamples.push(perWeek);
      if (!perAuthor) authorStatsOk = false;
      for (const [login, a] of perAuthor ?? []) {
        const prev = authorCommits.get(login);
        authorCommits.set(login, {
          commits: (prev?.commits ?? 0) + a.commits,
          avatar: a.avatar,
          weeks: [...prev?.weeks ?? [], ...a.weeks],
          ...a.bot ? { bot: a.bot } : {}
        });
      }
      for (const c of counts ?? []) {
        const t = monthTotals.get(c.month) ?? { commits: 0, merged: 0 };
        t.commits += c.commits;
        t.merged += c.merged;
        monthTotals.set(c.month, t);
      }
      releases.push(...ships.releases.dates);
      deploys.push(...ships.deploys.dates);
      tags.push(...ships.tags.dates);
      for (const k of ["releases", "deploys", "tags"]) {
        shipCoverage[k] = Math.max(shipCoverage[k], ships[k].coveredFrom);
      }
      reposDone += 1;
      await publish();
    }
  };
  await Promise.all(Array.from({ length: Math.min(REPO_CONCURRENCY, repos.length) }, worker));
  await chain;
  await report({ activity: "Counting who shipped what…", progress: 0.98 });
  const ranked = metrics(repos.length).people;
  const candidates = [...ranked.filter((p) => !p.agent).slice(0, 15), ...ranked.filter((p) => p.agent).slice(0, 10)];
  const sinceDay = new Date(since).toISOString().slice(0, 10);
  const repoPersonPrs = /* @__PURE__ */ new Map();
  for (const repo of repos) {
    const counts = await personPrCounts(token, repo.fullName, candidates, sinceDay).catch(() => null);
    if (counts) repoPersonPrs.set(repo.fullName, counts);
    for (const [login, c] of counts ?? []) {
      const prev = personPrs.get(login) ?? { merged: 0, reviews: 0 };
      personPrs.set(login, { merged: prev.merged + c.merged, reviews: prev.reviews + c.reviews });
    }
  }
  const agents = findAgents([...prs, ...weekSamples.flat().flatMap((w) => w.sample)]);
  const parts = repos.length > 1 ? repos.flatMap((repo) => {
    const own = perRepo.get(repo.fullName);
    if (!own) return [];
    return [
      computeRepoPart(repo.fullName, {
        ...own,
        prs: prs.filter((p) => p.repo === repo.fullName),
        personPrs: repoPersonPrs.get(repo.fullName),
        isPublic: Boolean(target),
        team: repo.owner,
        reposTotal: 1,
        reposDone: 1,
        now,
        tz,
        agents
      })
    ];
  }) : [];
  const final = {
    ...metrics(repos.length),
    ...parts.length > 1 ? { repoNames: parts.map((p) => p.repo) } : {}
  };
  return {
    metrics: final,
    parts,
    activity: `Read ${plural(final.prs, "pull request")} across ${plural(repos.length, "repo")}`
  };
}

// src/lib/format.ts
function splitHours(hours) {
  if (hours < 1) {
    const m = Math.max(1, Math.round(hours * 60));
    return { value: String(m), unit: "min", long: `${m} minute${m === 1 ? "" : "s"}` };
  }
  if (hours < 48) {
    const h = hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours);
    return { value: String(h), unit: "h", long: `${h} hour${h === 1 ? "" : "s"}` };
  }
  return splitDays(hours / 24);
}
function splitDays(days) {
  if (days < 1) return splitHours(days * 24);
  const d = days < 10 ? Math.round(days * 10) / 10 : Math.round(days);
  return { value: String(d), unit: "d", long: `${d} day${d === 1 ? "" : "s"}` };
}

// src/lib/benchmarks.ts
var HEALTHY = {
  reviewWaitHours: 4,
  mergeHours: 24,
  unreviewedPct: 10,
  shipWeeks: WINDOW_WEEKS
};
var MIN_SAMPLE = 5;
var WEEK_MS = 7 * 864e5;
function toneFor(ratio) {
  if (ratio <= 1) return "good";
  if (ratio <= 1.5) return "warn";
  return "bad";
}
function shipWeeks(ships, now) {
  const weeks = /* @__PURE__ */ new Set();
  for (const t of ships) {
    const w = Math.floor((now - t) / WEEK_MS);
    if (w >= 0 && w < WINDOW_WEEKS) weeks.add(w);
  }
  return weeks.size;
}
function buildRows(gh) {
  const rows = [];
  const add = (r) => rows.push({ ...r, tone: toneFor(r.ratio) });
  if (gh?.reviewWaitHours != null && gh.reviewWaitSample >= MIN_SAMPLE) {
    const v = splitHours(gh.reviewWaitHours);
    add({
      key: "reviewWait",
      label: "Review wait",
      means: "From ready for review to the first review",
      value: v,
      healthy: `under ${HEALTHY.reviewWaitHours}h`,
      ratio: gh.reviewWaitHours / HEALTHY.reviewWaitHours,
      fix: "Agree on a first review within 4 working hours and rotate a daily reviewer.",
      tip: "Rotate a daily reviewer",
      headline: {
        lead: "Pull requests wait",
        tail: "for a first review.",
        healthyLine: `Healthy teams: under ${HEALTHY.reviewWaitHours}.`
      }
    });
  }
  if (gh?.mergeHours != null && gh.mergeSample >= MIN_SAMPLE) {
    add({
      key: "merge",
      label: "Time to merge",
      means: "From opened to merged, automerges excluded",
      value: splitHours(gh.mergeHours),
      healthy: "under 1d",
      ratio: gh.mergeHours / HEALTHY.mergeHours,
      fix: "Keep pull requests small and merge them the day they're approved.",
      tip: "Merge the day it's approved",
      headline: { lead: "A pull request takes", tail: "to merge.", healthyLine: "Healthy teams merge within a day." }
    });
  }
  if (gh?.unreviewedPct != null && gh.merged >= MIN_SAMPLE) {
    const v = String(gh.unreviewedPct);
    add({
      key: "unreviewed",
      label: "Merged without review",
      means: "Merged pull requests nobody else approved",
      value: { value: v, unit: "%", long: `${v}%` },
      healthy: `under ${HEALTHY.unreviewedPct}%`,
      ratio: gh.unreviewedPct / HEALTHY.unreviewedPct,
      fix: "Turn on branch protection: one approval before merging to main.",
      tip: "Require one approval on main",
      headline: {
        lead: "",
        tail: "of merged pull requests had no review at all.",
        healthyLine: `Healthy teams: under ${HEALTHY.unreviewedPct}%.`
      }
    });
  }
  const ships = gh?.ships ?? [];
  const from = gh?.shipsFrom ?? null;
  const asOf = gh?.asOf ?? Date.now();
  const readWeeks = from ? Math.min(WINDOW_WEEKS, Math.max(0, Math.ceil((asOf - from) / WEEK_MS))) : WINDOW_WEEKS;
  if (ships.length > 0 && readWeeks >= 1) {
    const weeks = shipWeeks(ships, asOf);
    add({
      key: "ships",
      label: "Weeks with a release",
      means: `Weeks with at least one release, of the last ${WINDOW_WEEKS}`,
      value: { value: String(weeks), unit: `/${readWeeks}`, long: `${weeks} of ${readWeeks} weeks` },
      healthy: "weekly",
      ratio: readWeeks / Math.max(1, weeks),
      // Too few weeks read to judge a rhythm: shown, never the headline.
      partial: readWeeks < 4,
      fix: "Automate the release and ship smaller batches, at least once a week.",
      tip: "Automate a weekly release",
      headline: {
        lead: "Shipped in",
        tail: "",
        healthyLine: "Healthy teams ship every week."
      }
    });
  }
  return rows.sort((a, b) => b.ratio - a.ratio);
}

// src/lib/showcase.ts
function describeTeam(name, gh) {
  if (!gh)
    return `How ${name} ships: release rhythm, review wait and time to merge from public GitHub data.`;
  const rows = buildRows(gh);
  const ships = rows.find((r) => r.key === "ships");
  const parts = [];
  if (ships) {
    const [shipped, read] = [
      ships.value.value,
      ships.value.unit.replace("/", "")
    ];
    parts.push(
      shipped === read ? `${name} released every week of the last ${read}` : `${name} released in ${shipped} of the last ${read} weeks`
    );
  }
  const wait = gh.reviewWaitHours != null ? splitHours(gh.reviewWaitHours).long : null;
  const merge = gh.mergeHours != null ? splitHours(gh.mergeHours).long : null;
  if (wait && merge)
    parts.push(
      `pull requests got a first review in ${wait} and merged in ${merge} (median)`
    );
  else if (merge) parts.push(`pull requests merged in ${merge} (median)`);
  if (parts.length === 0) return `How ${name} ships, from public GitHub data.`;
  const text = parts.join("; ");
  return text.startsWith(name) ? `${text}.` : `${text[0].toUpperCase()}${text.slice(1)}.`;
}
function shareTitle(name, gh) {
  const prs = gh ? Math.round(gh.weeklyPrs.slice(-WINDOW_WEEKS).reduce((a, w) => a + w.total, 0) / WINDOW_WEEKS) : 0;
  if (prs > 0) {
    const wait = gh.reviewWaitHours != null ? splitHours(gh.reviewWaitHours) : null;
    const pace = `${prs.toLocaleString("en-US")} PR${prs === 1 ? "" : "s"} a week`;
    return `How ${name} ships: ${wait ? `${pace}, first review in ${wait.value} ${wait.unit}` : pace}`;
  }
  const asOf = gh?.asOf ?? Date.now();
  const inWindow = (gh?.commitDays ?? []).filter(([day]) => {
    const w = Math.floor((asOf - Date.parse(day)) / (7 * 864e5));
    return w >= 0 && w < WINDOW_WEEKS;
  });
  const commits = Math.round(inWindow.reduce((a, [, n]) => a + n, 0) / WINDOW_WEEKS);
  if (commits > 0) return `How ${name} ships: ${commits.toLocaleString("en-US")} commits a week`;
  return `How ${name} ships, week by week`;
}

// scripts/pulse-repo-stats/dashboard.html
var dashboard_default = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>__PULSE_TITLE__</title>\n<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 32 32\'%3E%3Crect width=\'32\' height=\'32\' rx=\'7\' fill=\'%23221e1b\'/%3E%3Cpath d=\'M3 16.5h6.2l2.3-6.4a1 1 0 0 1 1.9.1l3.2 11.2 2.4-8.3a1 1 0 0 1 1.9-.1l1.7 3.5H29\' fill=\'none\' stroke=\'%23cb2e6a\' stroke-width=\'2.6\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E">\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=Spline+Sans:wght@300..700&display=swap" rel="stylesheet">\n<!-- Tailwind, compiled in the browser so nothing needs installing. Pinned by hash. -->\n<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.4/dist/index.global.js" integrity="sha384-LhJn7QKq7hHz9EqN//RkaYS9p1ZU3MqAxjeV0JI95iQ5Gol1uz/cQQ+pesz0xum7" crossorigin="anonymous"></script>\n<style>\n  /* Hidden until Tailwind\'s rules arrive (see the end of the theme), so the page doesn\'t flash unstyled. */\n  body { opacity: 0; background: #f6f3ef; }\n</style>\n<style type="text/tailwindcss">\n  /* The Pulse palette: warm greige paper, near-black ink, one cerise signal color. */\n  @theme static {\n    --font-sans: "Spline Sans", ui-sans-serif, system-ui, sans-serif;\n    --font-display: "Bricolage Grotesque", "Spline Sans", ui-sans-serif, sans-serif;\n\n    --color-background: #f6f3ef;\n    --color-foreground: #221e1b;\n    --color-card: #fcfbf9;\n    --color-primary-foreground: #faf8f5;\n    --color-border: #e5dfd6;\n    --color-border-strong: #d3cbbf;\n\n    --color-brand: #cb2e6a;\n    --color-ink: #221e1b;\n    --color-good: #2f7d4f;\n    --color-steel: #38699f;\n    --color-amber: #c07c10;\n    --color-moss: #3f8046;\n    --color-text-secondary: #5e574f;\n    --color-text-tertiary: #7c746a;\n    --color-grey-200: #f6f3ef;\n    --color-grey-300: #efeae2;\n    --color-grey-400: #e7e1d9;\n    --color-grey-500: #ded7cc;\n    --color-grey-600: #d3cbbf;\n\n    --radius-lg: 0.625rem;\n    --radius-xl: 0.875rem;\n\n    --shadow-xs: 0 1px 2px rgba(16, 24, 40, 0.04);\n    --shadow-sm: 0 1px 3px rgba(16, 24, 40, 0.06), 0 1px 2px rgba(16, 24, 40, 0.04);\n    --shadow-md: 0 8px 24px -6px rgba(16, 24, 40, 0.1);\n  }\n  @layer base {\n    * { @apply border-border; }\n    html { @apply font-sans antialiased; font-feature-settings: "ss01", "cv11"; }\n    body { @apply bg-background text-foreground; }\n    button { cursor: pointer; }\n    .tabular { font-variant-numeric: tabular-nums; }\n  }\n  html body { opacity: 1; }\n</style>\n</head>\n<body>\n<div id="app"></div>\n<div id="tip" hidden class="pointer-events-none fixed z-50 w-max max-w-80 -translate-x-1/2 -translate-y-full rounded-lg bg-ink px-3 py-2 text-sm text-primary-foreground shadow-md"></div>\n<script id="pulse-data" type="application/json">__PULSE_DATA__</script>\n<script>\n// Everything below draws the page from the numbers above. It sends nothing anywhere.\nconst DATA = JSON.parse(document.getElementById("pulse-data").textContent);\nconst gh = DATA.metrics;\nconst WINDOW_WEEKS = 12;\nconst COMMIT_WEEKS = 26;\nconst DAY_MS = 86_400_000;\nconst WEEK_MS = 7 * DAY_MS;\nconst asOf = gh.asOf ?? Date.now();\n\nsetTimeout(() => { document.body.style.opacity = 1; }, 2500); // Tailwind didn\'t load: show the page anyway.\n\nconst esc = (v) => String(v).replace(/[&<>"\']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", \'"\': "&quot;", "\'": "&#39;" })[c]);\nconst plural = (n, word, many = `${word}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? word : many}`;\nconst shortDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });\nconst tip = (html) => `data-tip="${esc(html)}"`;\n\nconst icon = (paths, cls) => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths.map((d) => `<path d="${d}"/>`).join("")}</svg>`;\nconst ICON = {\n  arrowRight: (c) => icon(["M5 12h14", "m12 5 7 7-7 7"], c),\n  arrowUpRight: (c) => icon(["M7 7h10v10", "M7 17 17 7"], c),\n  check: (c) => icon(["M20 6 9 17l-5-5"], c),\n  minus: (c) => icon(["M5 12h14"], c),\n  help: (c) => icon(["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", "M12 17h.01"], c),\n  trophy: (c) => icon(["M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2", "M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2", "M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3", "M4 22h16", "M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z", "M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"], c),\n};\n\n// Durations in the unit a person would say out loud.\nfunction splitHours(hours) {\n  if (hours < 1) { const m = Math.max(1, Math.round(hours * 60)); return { value: String(m), unit: "min" }; }\n  if (hours < 48) return { value: String(hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours)), unit: "h" };\n  const days = hours / 24;\n  return { value: String(days < 10 ? Math.round(days * 10) / 10 : Math.round(days)), unit: "d" };\n}\n\n// ---- People ----\n\nconst profileUrl = (p) => {\n  const bot = p.login.match(/^(.+)\\[bot\\]$/i);\n  return bot || p.app ? `https://github.com/apps/${bot ? bot[1] : p.login}` : `https://github.com/${p.login}`;\n};\nconst initial = (p, cls) => `<span class="grid size-7 shrink-0 place-items-center rounded-full bg-grey-400 text-xs font-semibold text-text-secondary ${cls}">${esc(p.login.slice(0, 1).toUpperCase())}</span>`;\nconst avatar = (p, cls = "") => p.avatar\n  ? `<img src="${esc(p.avatar)}" alt="" loading="lazy" data-fallback="${esc(initial(p, cls))}" class="size-7 shrink-0 rounded-full bg-grey-300 object-cover ${cls}">`\n  : initial(p, cls);\nconst personLine = (p) => [\n  p.merged && plural(p.merged, "PR merged", "PRs merged"),\n  p.reviews && plural(p.reviews, "review"),\n  p.commits && plural(p.commits, "commit"),\n].filter(Boolean).join(" · ");\nconst face = (p, cls) => `<a href="${esc(profileUrl(p))}" target="_blank" rel="noreferrer" aria-label="${esc(p.login)}" class="relative inline-flex hover:z-30" ${tip(`<span class="flex flex-col items-center text-center"><span class="font-semibold">${esc(p.login)}</span><span class="text-xs text-white/90">${esc(personLine(p) || "No activity")}</span></span>`)}>${avatar(p, `ring-2 ring-card ${cls}`)}</a>`;\n\n// ---- Verdicts ----\n\nconst TONE = { good: "text-good", warn: "text-amber", bad: "text-brand" };\n\nfunction verdict(row) {\n  if (row.key === "ships") {\n    const missed = Number(row.value.unit.replace("/", "")) - Number(row.value.value);\n    return missed === 0 ? "Every week" : `${missed} missed`;\n  }\n  if (row.tone === "good") return "On target";\n  return `${row.ratio < 10 ? Math.round(row.ratio * 10) / 10 : Math.round(row.ratio)}× target`;\n}\n\nfunction explain(row) {\n  if (row.key === "ships") {\n    const read = row.value.unit.replace("/", "");\n    return row.tone === "good"\n      ? `A release in every one of the ${read} weeks read. Healthy teams ship weekly.`\n      : `${verdict(row)}: weeks with no release, of the ${read} read. Healthy teams ship weekly.`;\n  }\n  const line = `Here: ${row.value.long}. Healthy teams: ${row.healthy}.`;\n  if (row.tone === "good") return `${line} This team is within that line.`;\n  const x = verdict(row).replace(" target", "");\n  return `${line} ${x} target means ${x} that line.`;\n}\n\nconst verdictBadge = (row) => `<button type="button" class="inline-flex shrink-0 cursor-help items-center gap-1 text-xs font-medium whitespace-nowrap tabular outline-none focus-visible:underline ${TONE[row.tone]}" ${tip(`<span class="flex flex-col items-start gap-1 text-[13px] leading-snug"><span class="font-medium">${esc(row.label)}</span>${row.key !== "ships" ? `<span class="text-primary-foreground/70">${esc(row.means)}.</span>` : ""}<span>${esc(explain(row))}</span><span class="text-xs text-primary-foreground/60">Targets come from DORA and LinearB benchmarks for healthy product teams.</span></span>`)}>${esc(verdict(row))}${ICON.help("size-3 opacity-60")}</button>`;\n\nconst NUMBER = "font-display text-[30px] leading-none font-semibold tracking-[-0.03em] tabular";\nconst UNIT = "ml-0.5 text-base font-medium tracking-normal text-text-tertiary";\nconst DASH = `<p class="text-[30px] leading-none font-semibold text-grey-500">–</p>`;\nconst rowNumber = (row, cls = "shrink-0") => row\n  ? `<p class="${cls} ${NUMBER}"><span data-count="${esc(row.value.value)}">${esc(row.value.value)}</span><span class="${UNIT}">${esc(row.value.unit)}</span></p>`\n  : DASH;\n\n// ---- The metrics strip ----\n\nconst SHIP_SOURCE = {\n  releases: "GitHub releases",\n  deploys: "production deploys",\n  branch: "merges to the production branch",\n  tags: "version tags",\n  push: "pushes to the default branch (no releases or deploys found)",\n};\n\nfunction releaseWeeks() {\n  const hit = new Set((gh.ships ?? []).map((t) => WINDOW_WEEKS - 1 - Math.floor((asOf - t) / WEEK_MS)));\n  const cells = Array.from({ length: WINDOW_WEEKS }, (_, i) => {\n    const start = new Date(asOf - (WINDOW_WEEKS - i) * WEEK_MS);\n    const shipped = hit.has(i);\n    const read = shipped || gh.shipsFrom == null || start.getTime() + WEEK_MS > gh.shipsFrom;\n    return `<span class="flex-1 rounded-[3px] ${shipped ? "bg-good" : read ? "bg-brand/15" : "bg-grey-300"}" ${tip(`<span class="font-semibold">Week of ${shortDate(start)}</span><span class="text-white/80"> · ${shipped ? "released" : read ? "no release" : "not read"}</span>`)}></span>`;\n  });\n  return `<div class="relative flex h-[30px] min-w-0 flex-1 gap-[3px]">${cells.join("")}</div>`;\n}\n\nfunction kpiReleases(row) {\n  const hint = gh.shipSource\n    ? `Weeks with a release, of the last ${WINDOW_WEEKS}. From ${SHIP_SOURCE[gh.shipSource] ?? gh.shipSource}.`\n    : `Weeks with a release, of the last ${WINDOW_WEEKS}.`;\n  return `<div class="flex min-w-0 flex-col gap-3 bg-card p-4 rounded-xl border border-border sm:col-span-2 lg:col-span-1">\n    <div class="flex items-center justify-between gap-2">\n      <h3 class="truncate text-[13px] font-medium" title="${esc(hint)}">Release weeks</h3>\n      ${row ? verdictBadge(row) : ""}\n    </div>\n    <div class="flex min-w-0 items-end gap-5">${rowNumber(row)}${releaseWeeks()}</div>\n  </div>`;\n}\n\nconst smallBars = (values) => {\n  const max = Math.max(1, ...values);\n  return `<span class="flex h-[30px] w-20 min-w-0 shrink items-end gap-[2px]">${values.map((v) => `<span class="flex-1 rounded-t-[2px]" style="height:${Math.max(6, (v / max) * 100)}%;background-color:color-mix(in srgb, var(--color-steel) 45%, transparent)"></span>`).join("")}</span>`;\n};\n\nconst cell = (label, hint, n, unit, inner) => `<div class="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4">\n  <h3 class="truncate text-[13px] font-medium" title="${esc(hint)}">${label}</h3>\n  <div class="flex min-w-0 items-end justify-between gap-4">\n    <p class="shrink-0 ${NUMBER}">${Math.round(n).toLocaleString("en-US")}${unit ? `<span class="${UNIT}">${unit}</span>` : ""}</p>\n    ${inner}\n  </div>\n</div>`;\n\nfunction throughput() {\n  const commitWeeks = Array.from({ length: WINDOW_WEEKS }, () => 0);\n  for (const [day, n] of gh.commitDays ?? []) {\n    const w = Math.floor((asOf - Date.parse(day)) / WEEK_MS);\n    if (w >= 0 && w < WINDOW_WEEKS) commitWeeks[WINDOW_WEEKS - 1 - w] += n;\n  }\n  const prWeeks = prWeekList.map((w) => w.total);\n  const avg = (list) => (list.length ? list.reduce((a, n) => a + n, 0) / list.length : 0);\n  const hint = `Average week, last ${WINDOW_WEEKS} weeks`;\n  return cell("PRs merged", hint, avg(prWeeks), "/week", smallBars(prWeeks)) + cell("Commits", hint, avg(commitWeeks), "/week", smallBars(commitWeeks));\n}\n\nfunction peopleCell() {\n  const humans = gh.people.filter((p) => !p.agent);\n  const faces = humans.filter((p) => p.avatar).slice(0, 10);\n  return cell("People", `Committed, merged or reviewed in the last ${WINDOW_WEEKS} weeks`, gh.peopleTotal ?? humans.length, "", `<span class="flex -space-x-1.5">${faces.map((p) => face(p, "size-6")).join("")}</span>`);\n}\n\n// ---- Merged PRs per week ----\n\nconst prWeekList = (gh.weeklyPrs ?? []).slice(-WINDOW_WEEKS);\nconst SEGMENTS = [\n  { key: "fast", label: "reviewed within a day", color: "var(--color-moss)" },\n  { key: "slow", label: "waited over a day", color: "var(--color-brand)" },\n  { key: "unreviewed", label: "no review", color: "var(--color-grey-600)" },\n];\n\nfunction legend() {\n  const items = [["Reviewed < 1 day", "var(--color-moss)"], ["Waited longer", "var(--color-brand)"], ["No review", "var(--color-grey-600)"]];\n  if (prWeekList.some((w) => w.total > 0 && w.fast + w.slow + w.unreviewed === 0)) {\n    items.push(["Not sampled", "color-mix(in srgb, var(--color-steel) 40%, transparent)"]);\n  }\n  return `<div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-tertiary">${items.map(([label, color]) => `<span class="inline-flex items-center gap-1.5"><span class="size-2 rounded-[2px]" style="background-color:${color}"></span>${esc(label)}</span>`).join("")}</div>`;\n}\n\nfunction prWeeks() {\n  const weeks = prWeekList;\n  if (weeks.every((w) => w.total === 0)) return `<p class="text-sm text-text-tertiary">No merged pull requests.</p>`;\n  const max = Math.max(1, ...weeks.map((w) => w.total));\n  const label = (i) => shortDate(new Date(asOf - (weeks.length - i) * WEEK_MS));\n  const bars = weeks.map((w, i) => {\n    const sampled = w.fast + w.slow + w.unreviewed;\n    const lines = sampled > 0 ? SEGMENTS.filter((s) => w[s.key]).map((s) => `<span class="inline-flex items-center gap-1.5 text-xs text-white/90"><span class="size-2 rounded-full" style="background-color:${s.color}"></span>${Math.round((w[s.key] / sampled) * 100)}% ${s.label}</span>`).join("") : "";\n    const ai = w.agent || w.agentReviewed\n      ? `<span class="text-xs text-white/90">AI agents: ${w.agent ? `opened ~${w.agent}` : ""}${w.agent && w.agentReviewed ? ", " : ""}${w.agentReviewed ? `reviewed ~${w.agentReviewed}` : ""}</span>`\n      : "";\n    const fill = sampled === 0\n      ? `<span class="h-full bg-steel/40"></span>`\n      : SEGMENTS.filter((s) => w[s.key]).map((s) => `<span style="height:${(w[s.key] / sampled) * 100}%;background-color:${s.color}"></span>`).join("");\n    return `<div class="flex h-full flex-1 flex-col justify-end" ${tip(`<div class="flex flex-col gap-1"><span class="whitespace-nowrap"><span class="font-semibold">Week of ${label(i)}</span><span class="text-white/90"> · ${plural(w.total, "PR merged", "PRs merged")}</span></span>${lines}${ai}</div>`)}><div class="flex w-full flex-col-reverse overflow-hidden rounded-[3px] hover:opacity-85" style="height:${(w.total / max) * 100}%">${fill}</div></div>`;\n  }).join("");\n  const labels = weeks.map((_, i) => `<span class="flex-1 text-center text-[11px] whitespace-nowrap text-text-tertiary">${i % 2 === 0 ? label(i) : ""}</span>`).join("");\n  return `<div class="relative flex flex-1 flex-col">\n    <span class="text-[11px] text-text-tertiary tabular">${max}</span>\n    <div class="flex min-h-36 flex-1 items-end gap-1.5 border-b border-border pt-1">${bars}</div>\n    <div class="flex gap-1.5 pt-1.5">${labels}</div>\n  </div>`;\n}\n\nfunction reviews() {\n  const row = (key) => DATA.rows.find((r) => r.key === key);\n  const rows = [["Review wait", row("reviewWait")], ["Time to merge", row("merge")], ["Merged unreviewed", row("unreviewed")]];\n  return `<section class="flex min-w-0 flex-col rounded-xl border border-border bg-card p-4">\n    <div class="flex items-baseline justify-between gap-3 pb-1">\n      <h3 class="text-[13px] font-medium">Reviews</h3>\n      <span class="text-xs text-text-tertiary">Last ${WINDOW_WEEKS} weeks</span>\n    </div>\n    <dl class="flex flex-1 flex-col justify-around">${rows.map(([label, r]) => `\n      <div class="flex items-center justify-between gap-4 border-t border-border py-3 first:border-t-0">\n        <dt class="flex min-w-0 flex-col gap-1"><span class="truncate text-[13px] text-text-secondary" title="${esc(r?.means ?? "")}">${label}</span></dt>\n        <dd class="shrink-0">${rowNumber(r, "")}</dd>\n      </div>`).join("")}\n    </dl>\n  </section>`;\n}\n\n// ---- Commits: the contribution grid ----\n\nfunction activityGrid() {\n  const CELL = 14, GAP = 3, STEP = CELL + GAP, LEFT = 18, TOP = 16, WEEKS = COMMIT_WEEKS;\n  const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;\n  const heatColor = (l) => (l === 0 ? "var(--color-grey-300)" : `color-mix(in srgb, var(--color-steel) ${[0, 30, 52, 76, 100][l]}%, var(--color-grey-200))`);\n  const byDay = new Map((gh.commitDays ?? []).map(([day, count, who]) => [day, { count, who }]));\n  const byLogin = new Map(gh.people.map((p) => [p.login, p]));\n  const now = new Date(asOf);\n  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());\n  const first = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() - (WEEKS - 1) * 7);\n  const cells = [];\n  for (let i = 0; i < WEEKS * 7; i++) {\n    const date = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i);\n    const hit = byDay.get(dayKey(date));\n    cells.push({ date, count: hit?.count ?? 0, who: hit?.who ?? [], future: date > today });\n  }\n  let months = [];\n  for (let col = 0; col < WEEKS; col++) {\n    const d = cells[col * 7].date;\n    const prev = col > 0 ? cells[(col - 1) * 7].date : null;\n    if ((!prev || prev.getMonth() !== d.getMonth()) && col < WEEKS - 1) months.push({ col, label: d.toLocaleDateString("en-US", { month: "short" }) });\n  }\n  if (months[1] && months[1].col - months[0].col < 3) months = months.slice(1);\n  // Quartiles of active days, so one huge day doesn\'t wash out the rest.\n  const active = cells.map((c) => c.count).filter((n) => n > 0).sort((a, b) => a - b);\n  const at = (q) => active[Math.floor((active.length - 1) * q)] ?? 1;\n  const cuts = [at(0.25), at(0.5), at(0.75)];\n  const level = (n) => (n === 0 ? 0 : n <= cuts[0] ? 1 : n <= cuts[1] ? 2 : n <= cuts[2] ? 3 : 4);\n  const total = cells.reduce((a, c) => a + c.count, 0);\n  const width = LEFT + WEEKS * STEP - GAP;\n  const height = TOP + 7 * STEP - GAP;\n\n  const rects = cells.map((c, i) => {\n    if (c.future) return "";\n    const col = Math.floor(i / 7);\n    const row = i % 7;\n    const who = c.who.map((login) => `<span class="inline-flex items-center gap-1.5 text-xs text-white">${avatar(byLogin.get(login) ?? { login, avatar: null }, "size-5")}${esc(login)}</span>`).join("");\n    const when = c.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });\n    return `<rect x="${LEFT + col * STEP}" y="${TOP + row * STEP}" width="${CELL}" height="${CELL}" rx="3" class="hover:opacity-70" style="fill:${heatColor(level(c.count))}" ${tip(`<div class="flex flex-col gap-1.5"><span class="whitespace-nowrap"><span class="font-semibold">${when}</span><span class="text-white/90"> · ${plural(c.count, "commit")}</span></span>${who}</div>`)}></rect>`;\n  }).join("");\n\n  return `<div class="relative flex w-fit max-w-full shrink-0 flex-col gap-2">\n    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="h-auto max-w-full" role="img" aria-label="${total} commits in the last ${WEEKS} weeks">\n      ${months.map((m) => `<text x="${LEFT + m.col * STEP}" y="10" class="fill-text-tertiary text-[10px]">${m.label}</text>`).join("")}\n      ${["M", "W", "F"].map((d, i) => `<text x="0" y="${TOP + (1 + i * 2) * STEP + CELL - 2}" class="fill-text-tertiary text-[9px]">${d}</text>`).join("")}\n      ${rects}\n    </svg>\n    <div class="flex items-center justify-between gap-3 text-xs text-text-tertiary tabular" style="padding-left:${LEFT}px">\n      <span class="truncate">${plural(total, "commit")}</span>\n      <span class="flex shrink-0 items-center gap-1">Less ${[0, 1, 2, 3, 4].map((l) => `<span class="size-2 rounded-[2px]" style="background-color:${heatColor(l)}"></span>`).join("")} More</span>\n    </div>\n  </div>`;\n}\n\n// ---- Commits: who writes them ----\n\nfunction commitShare() {\n  const R = 40, C = 2 * Math.PI * R, GAP = 1.5, FACE_R = 55, MIN_APART = 0.06;\n  const SHADES = [100, 78, 60, 45, 32].map((pct) => `color-mix(in srgb, var(--color-steel) ${pct}%, transparent)`);\n  const committers = gh.people.filter((p) => !p.agent && p.commits > 0).sort((a, b) => b.commits - a.commits);\n  const top = committers.slice(0, 5);\n  const whole = Math.max(gh.humanCommits ?? 0, committers.reduce((a, p) => a + p.commits, 0));\n  if (top.length < 2 || whole === 0) return "";\n  const topSum = top.reduce((a, p) => a + p.commits, 0);\n  const pct = (n) => `${Math.round((n / whole) * 100)}%`;\n  let at = 0, lastFace = -1;\n  const slices = top.map((p, i) => {\n    const share = p.commits / whole;\n    const start = at;\n    at += share;\n    const f = Math.max(start + share / 2, lastFace + MIN_APART);\n    lastFace = f;\n    return { person: p, share, start, face: f, color: SHADES[i] };\n  });\n  const arc = (start, share, color, value, label) => {\n    const dash = Math.max(0.5, share * C - GAP);\n    return `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${color}" stroke-width="11" stroke-dasharray="${dash} ${C - dash}" stroke-dashoffset="${-start * C}" class="transition-[stroke-width]" data-slice data-value="${esc(value)}" data-label="${esc(label)}"></circle>`;\n  };\n  const rest = whole > topSum ? arc(topSum / whole, 1 - topSum / whole, "var(--color-grey-500)", pct(whole - topSum), "everyone else") : "";\n  return `<div class="flex min-w-0 flex-1 flex-col lg:px-6">\n    <h3 class="pb-4 text-[13px] font-medium">Who commits</h3>\n    <div class="relative m-auto size-40" data-donut data-value="${pct(topSum)}" data-label="top ${top.length}">\n      <svg viewBox="0 0 100 100" class="size-full -rotate-90">${rest}${slices.map((s) => arc(s.start, s.share, s.color, pct(s.person.commits), s.person.login)).join("")}</svg>\n      <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">\n        <span class="text-lg leading-tight font-semibold tabular" data-donut-value>${pct(topSum)}</span>\n        <span class="max-w-full truncate text-[11px] text-text-tertiary" data-donut-label>top ${top.length}</span>\n      </div>\n      ${slices.map((s) => {\n        const angle = s.face * 2 * Math.PI;\n        return `<span class="absolute -translate-x-1/2 -translate-y-1/2 hover:z-30" style="left:${50 + FACE_R * Math.sin(angle)}%;top:${50 - FACE_R * Math.cos(angle)}%" data-slice data-value="${pct(s.person.commits)}" data-label="${esc(s.person.login)}">${face(s.person, "size-5")}</span>`;\n      }).join("")}\n    </div>\n  </div>`;\n}\n\n// ---- People ----\n\n// The true leader of each habit gets a badge; rows are the badge holders, then the strongest others.\nfunction rank(people) {\n  const badges = new Map();\n  const give = (p, b) => p && badges.set(p.login, [...(badges.get(p.login) ?? []), b]);\n  const top = (key) => [...people].filter((p) => p[key] > 0).sort((a, b) => b[key] - a[key])[0];\n  give(top("merged"), "Most shipped");\n  give(top("reviews"), "Top reviewer");\n  const fastest = [...people].filter((p) => p.mergeHours != null).sort((a, b) => a.mergeHours - b.mergeHours)[0];\n  if (fastest) { const t = splitHours(fastest.mergeHours); give(fastest, `Fastest merge, ${t.value}${t.unit}`); }\n  give(top("commits"), "Most commits");\n  const max = {\n    merged: Math.max(1, ...people.map((p) => p.merged)),\n    reviews: Math.max(1, ...people.map((p) => p.reviews)),\n    commits: Math.max(1, ...people.map((p) => p.commits)),\n  };\n  const score = (p) => p.merged / max.merged + p.reviews / max.reviews + p.commits / max.commits;\n  const holders = people.filter((p) => badges.has(p.login)).sort((a, b) => score(b) - score(a));\n  const others = people.filter((p) => !badges.has(p.login)).sort((a, b) => score(b) - score(a));\n  return [...holders, ...others].slice(0, 5).map((person) => ({ person, badges: badges.get(person.login) ?? [] }));\n}\n\nfunction aiCommitsPct() {\n  const cutoff = new Date(asOf - WINDOW_WEEKS * WEEK_MS).toISOString().slice(0, 10);\n  const inWindow = (gh.commitDays ?? []).filter(([day]) => day > cutoff).reduce((a, [, n]) => a + n, 0);\n  const agents = gh.ai?.commits ?? gh.people.filter((p) => p.agent).reduce((a, p) => a + p.commits, 0);\n  return inWindow > 0 ? Math.min(100, Math.round((agents / inWindow) * 100)) : null;\n}\n\nfunction team() {\n  const COLS = "grid grid-cols-[minmax(0,1fr)_3rem_3.5rem_3.5rem] items-center gap-x-2";\n  const num = (n) => (n > 0 ? n.toLocaleString("en-US") : `<span class="text-grey-500">–</span>`);\n  const agents = gh.people.filter((p) => p.agent);\n  const rows = rank(gh.people.filter((p) => !p.agent));\n  const list = rows.length === 0\n    ? `<p class="pt-1 text-sm text-text-tertiary">No one yet.</p>`\n    : `<ul class="flex flex-col">${rows.map(({ person, badges }) => `\n      <li class="${COLS} border-t border-border py-[7px] text-[13px] tabular">\n        <span class="flex min-w-0 items-center gap-2.5">\n          <a href="${esc(profileUrl(person))}" target="_blank" rel="noreferrer" class="flex min-w-0 items-center gap-2.5 hover:underline">${avatar(person, "size-6")}<span class="truncate font-medium">${esc(person.login)}</span></a>\n          ${badges.length ? `<span tabindex="0" aria-label="${esc(badges.join(", "))}" class="flex shrink-0 cursor-default outline-none" ${tip(`<span class="flex flex-col gap-1 text-[13px]">${badges.map((b) => `<span class="whitespace-nowrap">${esc(b)}</span>`).join("")}</span>`)}>${ICON.trophy("size-3.5 text-amber")}</span>` : ""}\n        </span>\n        <span class="text-right">${num(person.merged)}</span>\n        <span class="text-right">${num(person.reviews)}</span>\n        <span class="text-right text-text-secondary">${num(person.commits)}</span>\n      </li>`).join("")}</ul>`;\n  const pct = aiCommitsPct();\n  const sorted = [...agents].sort((a, b) => b.commits + b.merged + b.reviews - (a.commits + a.merged + a.reviews));\n  const agentRow = agents.length === 0 ? "" : `\n    <div class="group/agents relative mt-auto">\n      <button type="button" class="flex w-full items-center gap-2 border-t border-border pt-2.5 text-left text-xs outline-none focus-visible:underline">\n        <span class="font-medium text-text-secondary">AI agents</span>\n        <span class="flex shrink-0 -space-x-1">${agents.slice(0, 5).map((a) => avatar(a, "size-4 rounded-[4px] ring-1 ring-card")).join("")}</span>\n        ${agents.length > 5 ? `<span class="text-text-tertiary tabular">+${agents.length - 5}</span>` : ""}\n        ${pct ? `<span class="ml-auto shrink-0 text-text-tertiary tabular">${pct}% of commits</span>` : ""}\n      </button>\n      <div class="absolute right-0 bottom-full z-40 hidden pb-1.5 group-hover/agents:block group-focus-within/agents:block">\n        <div class="flex w-max max-w-sm min-w-56 flex-col items-start gap-1 rounded-lg bg-ink px-3 py-2 text-[13px] leading-snug text-primary-foreground shadow-md">\n          <span class="font-medium">AI agents${pct ? ` · ${pct}% of commits` : ""}</span>\n          <div class="grid w-full grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-1 pt-1 text-xs tabular">\n            <span></span>\n            <span class="text-right text-primary-foreground/60">PRs</span>\n            <span class="text-right text-primary-foreground/60">Reviews</span>\n            <span class="text-right text-primary-foreground/60">Commits</span>\n            ${sorted.map((a) => `<div class="contents">\n              <a href="${esc(profileUrl(a))}" target="_blank" rel="noreferrer" class="flex min-w-0 items-center gap-1.5 hover:underline">${avatar(a, "size-4 shrink-0 rounded-[4px]")}<span class="truncate">${esc(a.login.replace(/\\[bot\\]$/, ""))}</span></a>\n              <span class="text-right">${a.merged || "–"}</span>\n              <span class="text-right">${a.reviews || "–"}</span>\n              <span class="text-right">${a.commits || "–"}</span>\n            </div>`).join("")}\n          </div>\n        </div>\n      </div>\n    </div>`;\n  return `<section class="flex min-w-0 flex-col rounded-xl border border-border bg-card p-4">\n    <div class="${COLS} pb-2 text-xs text-text-tertiary">\n      <h3 class="text-[13px] font-medium text-foreground">People</h3>\n      <span class="text-right">PRs</span><span class="text-right">Reviews</span><span class="text-right">Commits</span>\n    </div>\n    ${list}\n    ${agentRow}\n  </section>`;\n}\n\n// ---- How code gets to production ----\n\nconst KIND_ORDER = ["Tests", "Lint & types", "Build", "Security", "AI review", "Preview", "Visual tests", "Coverage", "Performance", "Dependencies", "CLA", "Release", "Merge queue", "Monitoring", "Other", "Housekeeping"];\nconst pctOf = (n, of) => (of > 0 ? Math.round((n / of) * 100) : 0);\nconst muted = (s) => `<span class="font-normal text-text-tertiary">${s}</span>`;\nconst yes = (on, hidden = false) => (hidden && !on ? muted("Not readable") : on ? `<span aria-label="Yes">${ICON.check("size-4 text-good")}</span>` : `<span aria-label="No">${ICON.minus("size-4 text-grey-600")}</span>`);\nconst panel = (title, caption, inner) => `<section class="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4"><header><h3 class="text-[13px] font-medium">${esc(title)}</h3><p class="mt-0.5 text-xs text-text-tertiary">${esc(caption)}</p></header>${inner}</section>`;\nconst empty = (s) => `<p class="text-sm text-text-secondary">${s}</p>`;\n\nfunction gatesCard(g, c) {\n  if (!g) return panel("Gates on the main branch", "Rules every merge must pass", empty("Couldn\'t read this branch\'s rules."));\n  const hidden = g.classic && !g.pullRequest;\n  const open = !g.protected && !g.pullRequest && g.requiredChecks.length === 0;\n  const rows = [\n    ["Changes go through a PR", yes(g.pullRequest, hidden)],\n    ["Approvals required", hidden ? muted("Not readable") : g.approvals ? g.approvals : muted("None")],\n    ["Code owners must approve", yes(g.codeOwners, hidden)],\n    ["Required checks", g.requiredChecks.length > 0 ? `<span title="${esc(g.requiredChecks.join("\\n"))}" class="cursor-help underline decoration-dotted underline-offset-2">${g.requiredChecks.length}</span>` : muted("None")],\n    ["Force-push blocked", yes(g.forcePushBlocked)],\n    ["Signed commits", yes(g.signedCommits)],\n    ["Linear history", yes(g.linearHistory)],\n    ["Merge queue", yes(g.mergeQueue)],\n  ];\n  const body = open\n    ? empty(`<span class="font-medium text-brand">No rules on ${esc(g.branch)}.</span> Anyone with write access can push to it directly.`)\n    : `<dl class="flex flex-col divide-y divide-border text-sm">${rows.map(([label, value]) => `<div class="flex items-center justify-between gap-3 py-1.5"><dt class="text-text-secondary">${label}</dt><dd class="font-medium tabular">${value}</dd></div>`).join("")}</dl>`;\n  let foot = "";\n  if (c && c.sampled > 0) {\n    const none = c.noReviewRule === c.sampled;\n    foot = `<p class="mt-auto text-xs text-text-tertiary">Of the last ${c.sampled} merges: ${none ? "no review rule applied." : `${c.approved} approved`}${c.bypassed > 0 ? `, <span class="font-medium text-brand">${c.bypassed} merged without the required review</span>` : ""}${none ? "" : "."}</p>`;\n  }\n  return panel(`Gates on ${g.branch}`, "Rules every merge must pass, as set today", body + foot);\n}\n\nfunction checksCard(c) {\n  if (!c || c.sampled === 0) return panel("What runs on every PR", "Checks on recent merged PRs", empty("No merged pull requests to read."));\n  const groups = new Map();\n  const same = (a, b) => (a.url != null && a.url === b.url) || a.name.toLowerCase() === b.name.toLowerCase();\n  for (const t of c.tools) {\n    const group = groups.get(t.kind) ?? [];\n    const twin = group.findIndex((g) => same(g, t));\n    if (twin < 0) group.push(t);\n    else if (t.prs > group[twin].prs) group[twin] = t;\n    groups.set(t.kind, group);\n  }\n  const kinds = KIND_ORDER.filter((k) => groups.has(k));\n  const covered = pctOf(c.withChecks, c.sampled);\n  const stat = (value, label, bad) => `<div><p class="font-display text-[26px] leading-none font-semibold tracking-[-0.03em] tabular ${bad ? "text-brand" : ""}">${value}</p><p class="mt-1 text-xs text-text-tertiary">${label}</p></div>`;\n  const list = kinds.length === 0 ? empty("No checks ran on these pull requests.") : `<ul class="flex flex-col gap-2 text-sm">${kinds.map((kind) => {\n    const tools = groups.get(kind);\n    const share = pctOf(Math.max(...tools.map((t) => t.prs)), c.sampled);\n    const names = tools.map((t) => (t.url ? `<a href="${esc(t.url)}" target="_blank" rel="noreferrer" class="underline decoration-border-strong underline-offset-2 hover:text-foreground hover:decoration-current">${esc(t.name)}</a>` : esc(t.name))).join(", ");\n    return `<li class="grid grid-cols-[6.5rem_minmax(0,1fr)_2.5rem] items-baseline gap-x-2"><span class="${kind === "Housekeeping" ? "text-text-tertiary" : "text-text-secondary"}">${esc(kind)}</span><span class="text-xs leading-snug text-pretty text-text-tertiary" title="${esc(tools.map((t) => `${t.name}: ${t.prs} PRs`).join("\\n"))}">${names}</span><span class="text-right text-xs font-medium tabular">${share}%</span></li>`;\n  }).join("")}</ul>`;\n  return panel("What runs on every PR", `Checks that ran on the last ${c.sampled} merged PRs`, `<div class="flex gap-6">${stat(`${covered}%`, "had any check", covered < 80)}${stat(c.mergedRed, "merged failing", c.mergedRed > 0)}</div>${list}`);\n}\n\nfunction pipeline() {\n  const p = DATA.pipeline;\n  if (!p) return "";\n  return `<section class="flex flex-col gap-3">\n    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-3">\n      <h2 class="font-display text-xl font-semibold tracking-[-0.02em]">How code gets to production</h2>\n      <p class="text-xs text-text-tertiary">Experimental · read ${shortDate(new Date(p.readAt))} from branch rules and PR checks</p>\n    </div>\n    ${p.repos.map((r) => `<div class="flex flex-col gap-2">\n      ${p.repos.length > 1 ? `<h3 class="text-[13px] font-medium text-text-secondary">${esc(r.repo)}</h3>` : ""}\n      <div class="grid gap-3 lg:grid-cols-2">${gatesCard(r.gates, r.checks)}${checksCard(r.checks)}</div>\n    </div>`).join("")}\n  </section>`;\n}\n\n// ---- How we count ----\n\nfunction methodology() {\n  const items = [\n    ["Weeks with a release", "Weeks in the last 12 with at least one GitHub release, production deploy, merge to a production branch or version tag, whichever the team uses most."],\n    ["Review wait", "Median time from a pull request being ready for review to its first review by someone else."],\n    ["Time to merge", "Median time from opening a pull request to merging it. Automerges with no review are left out."],\n    ["Merged without review", "Share of merged pull requests that nobody other than the author reviewed."],\n    ["People and agents", "Everyone who committed, merged or reviewed in the last 12 weeks. AI agents that work under their own account are listed apart."],\n    ["By AI agents", "Share of merged pull requests opened by an AI agent, or of commits made by one, whichever is higher. Agents are Claude, Copilot, Codex, Devin and similar, plus a team\'s own bots whose pull requests read like an engineer\'s (varied titles, a written description), such as opencode-agent or posthog[bot]. Release, dependency and CI bots don\'t count."],\n    ["Reviewed by AI", "Share of merged pull requests that an AI reviewer commented on: CodeRabbit, Copilot, Greptile, Codex or a team\'s own review bot. Any bot that leaves review comments counts; approval-only, CI and code-scanning bots don\'t. AI reviews don\'t count toward review wait or merged without review."],\n  ];\n  return `<section class="mt-16">\n    <h2 class="font-display text-2xl font-semibold tracking-[-0.025em]">How we count</h2>\n    <dl class="mt-5 grid gap-x-10 gap-y-5 md:grid-cols-2">${items.map(([term, def]) => `<div><dt class="font-semibold">${term}</dt><dd class="mt-1 text-[15px] leading-relaxed text-text-secondary">${esc(def)}</dd></div>`).join("")}</dl>\n  </section>`;\n}\n\n// ---- The page ----\n\nconst glyph = `<span class="grid size-7 place-items-center rounded-[7px] bg-ink"><svg viewBox="0 0 32 32" class="size-[85%]" aria-hidden="true"><path d="M3 16.5h6.2l2.3-6.4a1 1 0 0 1 1.9.1l3.2 11.2 2.4-8.3a1 1 0 0 1 1.9-.1l1.7 3.5H29" fill="none" stroke="#cb2e6a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;\n\nconst row = (key) => DATA.rows.find((r) => r.key === key);\nconst updated = shortDate(new Date(asOf));\nconst repoLinks = DATA.repos.map((repo) => `<a href="https://github.com/${esc(repo)}" target="_blank" rel="noreferrer" class="inline-flex items-center gap-0.5 font-medium hover:underline">${esc(repo)} ${ICON.arrowUpRight("size-3.5")}</a>`).join("<br>");\n\ndocument.getElementById("app").innerHTML = `\n<div class="min-h-svh px-4 sm:px-6">\n  <div class="mx-auto max-w-[1200px]">\n    <nav class="flex items-center justify-between gap-3 py-5">\n      <a href="https://paralect.ai/repo" aria-label="Pulse home" class="inline-flex items-center gap-2">${glyph}<span class="font-display text-[19px] font-semibold tracking-[-0.02em]">Pulse</span></a>\n      <a href="https://paralect.ai" class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-[13px] font-semibold text-primary-foreground transition hover:bg-ink/85">Start shipping faster ${ICON.arrowRight("size-3.5")}</a>\n    </nav>\n\n    <header class="flex flex-col gap-5 pt-6 pb-8 md:flex-row md:items-end md:justify-between">\n      <div class="min-w-0">\n        <h1 class="font-display text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-[44px]">How <img src="https://github.com/${esc(DATA.owner)}.png?size=96" alt="" class="mx-0.5 inline-block size-[0.9em] -translate-y-[0.06em] -rotate-6 rounded-[0.22em] bg-grey-300 align-middle shadow-sm ring-1 ring-black/5"> ${esc(DATA.name)} ships</h1>\n        <p class="mt-3 max-w-3xl text-[17px] leading-relaxed text-text-secondary text-pretty">${esc(DATA.description)}</p>\n      </div>\n      <dl class="flex shrink-0 gap-6 text-sm md:text-right">\n        <div><dt class="text-text-tertiary">Repository</dt><dd>${repoLinks}</dd></div>\n        <div><dt class="text-text-tertiary">Updated</dt><dd class="font-medium">${updated}</dd></div>\n      </dl>\n    </header>\n\n    <div class="flex flex-col gap-3">\n      <section class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">\n        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">\n          ${kpiReleases(row("ships"))}\n          ${throughput()}\n        </div>\n        ${peopleCell()}\n      </section>\n\n      <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">\n        <section class="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4">\n          <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">\n            <h3 class="text-[13px] font-medium">Merged PRs per week</h3>\n            ${legend()}\n          </div>\n          ${prWeeks()}\n        </section>\n        ${reviews()}\n      </div>\n\n      <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">\n        <section class="flex flex-col gap-5 rounded-xl border border-border bg-card p-4 lg:flex-row lg:items-stretch">\n          <div class="flex min-w-0 flex-col gap-3">\n            <h3 class="text-[13px] font-medium">Commits</h3>\n            <div class="flex flex-1 flex-col justify-center">${activityGrid()}</div>\n          </div>\n          <div class="flex min-w-0 flex-1 lg:border-l lg:border-border">${commitShare()}</div>\n        </section>\n        ${team()}\n      </div>\n\n      ${pipeline()}\n    </div>\n\n    ${methodology()}\n\n    <footer class="mt-16 flex flex-col gap-4 border-t border-border py-10 sm:flex-row sm:items-center sm:justify-between">\n      <div>\n        <p class="font-display text-lg font-semibold tracking-[-0.02em]">Curious how other teams ship?</p>\n        <p class="text-sm text-text-secondary">Same numbers, same 12 weeks, for Next.js, PostHog, Supabase and more.</p>\n        <p class="mt-1 text-xs text-text-tertiary">This page was read from GitHub on your computer. Nothing was sent to Pulse.</p>\n      </div>\n      <a href="https://paralect.ai/repo" class="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border-strong bg-card px-4 text-sm font-semibold transition hover:border-foreground/40">See other teams ${ICON.arrowRight("size-4")}</a>\n    </footer>\n  </div>\n</div>`;\n\n// ---- Behaviour: tooltips, the donut\'s middle, broken avatars, numbers ticking up ----\n\nconst tipEl = document.getElementById("tip");\nfunction placeTip(x, y) {\n  const half = tipEl.offsetWidth / 2;\n  tipEl.style.left = `${Math.max(half + 8, Math.min(x, window.innerWidth - half - 8))}px`;\n  tipEl.style.top = `${Math.max(tipEl.offsetHeight + 8, y - 14)}px`;\n}\nconst hideTip = () => { tipEl.hidden = true; };\nfunction showTip(target, x, y) {\n  tipEl.innerHTML = target.getAttribute("data-tip");\n  tipEl.hidden = false;\n  placeTip(x, y);\n}\nlet tipFor = null;\ndocument.addEventListener("mousemove", (e) => {\n  const target = e.target instanceof Element ? e.target.closest("[data-tip]") : null;\n  if (!target) { tipFor = null; hideTip(); return; }\n  if (target !== tipFor) { tipFor = target; showTip(target, e.clientX, e.clientY); }\n  else placeTip(e.clientX, e.clientY);\n});\ndocument.addEventListener("mouseleave", hideTip);\ndocument.addEventListener("focusin", (e) => {\n  const target = e.target.closest?.("button[data-tip], span[data-tip]");\n  if (!target || !target.matches(":focus-visible")) return;\n  const box = target.getBoundingClientRect();\n  showTip(target, box.left + box.width / 2, box.top);\n});\ndocument.addEventListener("focusout", hideTip);\ndocument.addEventListener("keydown", (e) => { if (e.key === "Escape") hideTip(); });\n\nfor (const donut of document.querySelectorAll("[data-donut]")) {\n  const value = donut.querySelector("[data-donut-value]");\n  const label = donut.querySelector("[data-donut-label]");\n  const set = (v, l) => { value.textContent = v; label.textContent = l; };\n  for (const slice of donut.querySelectorAll("[data-slice]")) {\n    const isArc = slice.tagName.toLowerCase() === "circle";\n    slice.addEventListener("mouseenter", () => {\n      set(slice.dataset.value, slice.dataset.label);\n      if (isArc) slice.setAttribute("stroke-width", "14");\n    });\n    slice.addEventListener("mouseleave", () => {\n      set(donut.dataset.value, donut.dataset.label);\n      if (isArc) slice.setAttribute("stroke-width", "11");\n    });\n  }\n}\n\nfor (const img of document.querySelectorAll("img[data-fallback]")) {\n  img.addEventListener("error", () => { img.outerHTML = img.dataset.fallback; });\n}\n\nif (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {\n  for (const el of document.querySelectorAll("[data-count]")) {\n    const text = el.dataset.count;\n    const target = Number.parseFloat(text);\n    if (!Number.isFinite(target)) continue;\n    const decimals = text.includes(".") ? text.split(".")[1].length : 0;\n    const start = performance.now();\n    const tick = (now) => {\n      const t = Math.min(1, (now - start) / 900);\n      el.textContent = (target * (1 - (1 - t) ** 3)).toFixed(decimals);\n      if (t < 1) requestAnimationFrame(tick);\n    };\n    requestAnimationFrame(tick);\n  }\n}\n</script>\n</body>\n</html>\n';

// scripts/pulse-repo-stats/cli.ts
var USAGE = `Usage: pulse-repo-stats [owner/repo ...] [options]

Reads the last ${WINDOW_WEEKS} weeks of a GitHub repo and writes a one-file HTML dashboard.
With no repo, uses the "origin" remote of the current folder.

  --name "Acme"   Name in the page title (default: the repo's name)
  --out file      Where to write it (default: out/pulse-repo-stats/<owner>-<repo>-<date>.html)
  --no-open       Don't open it in the browser
  --no-pipeline   Skip the branch rules and PR checks section
  --print-template  Print the page's HTML template. Save it as dashboard.html next to
                  this script, edit it, and later runs use your copy.
  --help          Show this

Sign in with "gh auth login", or set GH_TOKEN. Needs the "repo" scope for private repos.`;
var UserError = class extends Error {
};
function parseArgs(argv) {
  const options = { repos: [], open: true, pipeline: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (!next) throw new UserError(`${arg} needs a value.

${USAGE}`);
      return next;
    };
    if (arg === "--help" || arg === "-h") {
      console.log(USAGE);
      process.exit(0);
    } else if (arg === "--print-template") {
      process.stdout.write(dashboard_default);
      process.exit(0);
    } else if (arg === "--name") options.name = value();
    else if (arg === "--out") options.out = value();
    else if (arg === "--no-open") options.open = false;
    else if (arg === "--no-pipeline") options.pipeline = false;
    else if (arg.startsWith("-")) throw new UserError(`Unknown option ${arg}.

${USAGE}`);
    else options.repos.push(arg);
  }
  return options;
}
function repoSlug(input) {
  const match = input.trim().replace(/\.git$/, "").replace(/\/+$/, "").match(/(?:github\.com[/:])?([\w.-]+\/[\w.-]+)$/i);
  return match?.[1] ?? null;
}
function repoFromGit() {
  let remote;
  try {
    remote = execFileSync("git", ["remote", "get-url", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
  } catch {
    throw new UserError(`This folder has no git remote called "origin". Name the repo: pulse-repo-stats owner/repo`);
  }
  if (!/github\.com[/:]/i.test(remote)) {
    throw new UserError(`The "origin" remote isn't on GitHub (${remote.trim()}). Only GitHub repos can be read.`);
  }
  const slug = repoSlug(remote);
  if (!slug) throw new UserError(`Couldn't read a repo name from the remote "${remote.trim()}".`);
  return slug;
}
function findToken() {
  const fromEnv = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (fromEnv) return fromEnv;
  try {
    const token = execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    if (token) return token;
  } catch {
  }
  throw new UserError(
    "No GitHub sign-in found. Run `gh auth login` (https://cli.github.com), or set GH_TOKEN to a token with the repo scope."
  );
}
async function resolveRepo(token, slug) {
  try {
    const r = await request(token, `/repos/${slug}`);
    return { owner: r.owner.login, name: r.name, fullName: r.full_name, private: r.private };
  } catch (e) {
    if (e instanceof GithubError && e.status === 404) {
      throw new UserError(
        `GitHub can't find ${slug} with this sign-in. Check the name and that this account can see the repo. For a private repo, the token needs the repo scope; for an org with SSO, authorize it: gh auth refresh -s repo,read:org`
      );
    }
    throw e;
  }
}
function progressPrinter() {
  let shown = -1;
  return (activity, progress) => {
    if (!activity) return;
    const step = Math.floor((progress ?? 0) * 10);
    if (step <= shown) return;
    shown = step;
    console.error(`${String(Math.round((progress ?? 0) * 100)).padStart(3)}%  ${activity}`);
  };
}
function openInBrowser(file) {
  const [command, args] = process.platform === "darwin" ? ["open", [file]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", file]] : ["xdg-open", [file]];
  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.on("error", () => {
    });
    child.unref();
  } catch {
  }
}
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const slugs = (options.repos.length > 0 ? options.repos : [repoFromGit()]).map((input) => {
    const slug = repoSlug(input);
    if (!slug) throw new UserError(`"${input}" doesn't look like a repo. Use owner/repo.`);
    return slug;
  });
  const token = findToken();
  const repos = await Promise.all(slugs.map((slug) => resolveRepo(token, slug)));
  const name = options.name ?? (repos.length === 1 ? repos[0].name : repos[0].owner);
  console.error(`Reading ${repos.map((r) => r.fullName).join(", ")}. Takes a minute or two, longer on a busy repo.`);
  const print = progressPrinter();
  const { metrics } = await readGithub({
    token,
    repos,
    windowDays: WINDOW_DAYS,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    live: false,
    report: async (connection) => print(connection.activity, connection.progress)
  });
  const pipeline = [];
  if (options.pipeline) {
    console.error("Reading branch rules and PR checks…");
    for (const repo of repos) {
      const read = await readPipeline(token, repo).catch(() => null);
      if (read && (read.gates || read.checks)) pipeline.push(read);
    }
  }
  const custom = join(dirname(fileURLToPath(import.meta.url)), "dashboard.html");
  const template = existsSync(custom) ? readFileSync(custom, "utf8") : dashboard_default;
  const data = {
    name,
    repos: repos.map((r) => r.fullName),
    owner: repos[0].owner,
    description: describeTeam(name, metrics),
    rows: buildRows(metrics),
    metrics,
    pipeline: pipeline.length > 0 ? { readAt: Date.now(), repos: pipeline } : null
  };
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const html = template.replace("__PULSE_TITLE__", () => `How ${escapeHtml(name)} ships`).replace("__PULSE_DATA__", () => json);
  const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const out = options.out ? resolve(options.out) : resolve("out", "pulse-repo-stats", `${repos[0].fullName.replace("/", "-").toLowerCase()}-${date}.html`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  if (options.open) openInBrowser(out);
  const line = (key) => data.rows.find((r) => r.key === key)?.value.long ?? "not enough data";
  console.log(`Report: ${out}`);
  console.log(shareTitle(name, metrics));
  console.log(`Release weeks: ${line("ships")}`);
  console.log(`Review wait (median): ${line("reviewWait")}`);
  console.log(`Time to merge (median): ${line("merge")}`);
  console.log(`Merged without review: ${line("unreviewed")}`);
  console.log(`People: ${metrics.peopleTotal ?? metrics.people.filter((p) => !p.agent).length}`);
  console.log(`AI agents: ${metrics.people.filter((p) => p.agent).map((p) => p.login).join(", ") || "none seen"}`);
}
var escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
main().catch((e) => {
  if (e instanceof UserError) console.error(e.message);
  else console.error(`Couldn't finish the read: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
export {
  repoSlug
};
