type Rule = { allow: boolean; pattern: RegExp; length: number };

/** The rules that apply to every app ("User-agent: *"), from all such groups in the file. */
function rulesForEveryone(robots: string): { rules: Rule[]; delay: number } {
  const rules: Rule[] = [];
  let delay = 0;
  let agents: string[] = [];
  let inRules = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (inRules) agents = [];
      agents.push(value);
      inRules = false;
      continue;
    }
    inRules = true;
    if (!agents.includes('*')) continue;
    if (key === 'crawl-delay') delay = Math.max(delay, Number(value) || 0);
    if ((key === 'allow' || key === 'disallow') && value) {
      const source = value.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\\\$$/, '$').replace(/\*/g, '.*');
      rules.push({ allow: key === 'allow', pattern: new RegExp(`^${source}`), length: value.length });
    }
  }
  return { rules, delay };
}

/** Whether robots.txt lets any app read `path`. The longest matching rule wins; Allow wins a tie. */
export function robotsAllows(robots: string, path: string): boolean {
  const matches = rulesForEveryone(robots).rules.filter((r) => r.pattern.test(path));
  if (!matches.length) return true;
  matches.sort((a, b) => b.length - a.length || Number(b.allow) - Number(a.allow));
  return matches[0].allow;
}

/** Seconds the site asks apps to wait between requests (0 if it doesn't say). */
export function crawlDelaySeconds(robots: string): number {
  return rulesForEveryone(robots).delay;
}
