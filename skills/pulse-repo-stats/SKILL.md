---
name: pulse-repo-stats
description: "Build the Pulse engineering dashboard for a GitHub repo on this computer, as one HTML file - release weeks, PRs merged per week, review wait, time to merge, unreviewed merges, the commit grid, who does the work, how much of it AI agents do, and branch rules. Use when someone runs /pulse-repo-stats, or asks how their team ships, for engineering stats or velocity metrics on a repo, or for a Pulse report on their own repo. Works on private repos; needs only Node and a GitHub sign-in."
---

# Pulse repo stats

Reads the last 12 weeks of a GitHub repo and writes the same dashboard as paralect.ai/repo/vercel/next.js as one HTML file. It installs nothing. The numbers stay on this computer: the script talks only to api.github.com, and the page loads Tailwind and fonts from public CDNs and avatars from GitHub.

## Steps

1. **Pick the repo.** Use what the user named (`owner/repo` or a GitHub URL; several are fine if they asked for a combined view). If they named none, run it with no repo: the script uses the `origin` remote of the current folder.

2. **Pick the name for the title.** The page says "How <name> ships". It defaults to the repo's name. If the product has a nicer name that you can see in the README or `package.json` (`acme-web` is "Acme"), pass it with `--name`.

3. **Run it** from this skill's folder path, with a 10-minute timeout, because a busy repo takes several minutes:

   ```bash
   node <this-skill-folder>/scripts/pulse-repo-stats.mjs owner/repo --name "Acme"
   ```

   Progress goes to stderr. It opens the file in the browser when done.

4. **Report back.** Stdout has the file's path and the headline numbers. Give the user the path, then the two or three numbers that say the most about this team. If a number says "not enough data", say so: don't estimate it.

## Options

| Option | What it does |
| --- | --- |
| `--name "Acme"` | Name in the page title |
| `--out path.html` | Where to write it. Default: `~/pulse-repo-stats/<owner>-<repo>-<date>.html` |
| `--no-open` | Don't open the browser. Use this on a machine with no display. |
| `--no-pipeline` | Skip the "How code gets to production" section |
| `--print-template` | Print the page's HTML, to customize it (see below) |

## When it fails

| Message | What to do |
| --- | --- |
| `node: command not found`, or a syntax error | It needs Node 18 or newer. Ask the user to install it from nodejs.org. |
| `No GitHub sign-in found` | Ask the user to run `gh auth login` themselves, since it's interactive, or to set `GH_TOKEN`. Don't ask them to paste a token into this chat. |
| `GitHub can't find owner/repo` | Check the name. If it's right, this account can't see the repo: `gh auth refresh -s repo,read:org` grants access to private and SSO-protected repos. |
| `GitHub 403` | Usually a rate limit. Wait a few minutes and run it again. |

Never print the token or write it to a file.

## What the numbers mean

The page explains each one under "How we count". Three things come up often:

- **Review wait and merged without review** count people only. An AI reviewer's comment isn't a review here.
- **Busy repos are sampled.** Weekly PR totals are exact, and the split by review speed is scaled up from the latest 25 PRs of each week. Medians use the most recent 400 PRs at most.
- **Targets** (first review under 4 h, merge under 1 d, under 10% unreviewed, a release every week) come from DORA and LinearB benchmarks for product teams. Open-source projects often work differently.

## Changing the page

The page's plain HTML, Tailwind classes and a little JavaScript are built into the script. To change the look, save them next to it, edit that copy and run the script again; it uses `dashboard.html` when it finds one:

```bash
node <this-skill-folder>/scripts/pulse-repo-stats.mjs --print-template > <this-skill-folder>/scripts/dashboard.html
```
