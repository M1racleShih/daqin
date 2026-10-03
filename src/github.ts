import { command } from "./command.ts";

export type Issue = { number: number; title: string; body: string; updatedAt: string; url: string; state: string };
export type PullRequest = { number: number; url: string; state: string; isDraft: boolean; headRefOid: string; baseRefName: string };

export function readIssue(repo: string, number: number): Issue {
  return JSON.parse(command("gh", ["issue", "view", String(number), "--repo", repo,
    "--json", "number,title,body,updatedAt,url,state"]));
}

export function readFeedback(repo: string, url: string, issueNumber: number, prNumber?: number) {
  const prefix = `https://github.com/${repo}/`;
  const match = url.match(/\/(?:issues|pull)\/(\d+)#issuecomment-(\d+)$/);
  if (!url.startsWith(prefix) || !match || ![issueNumber, prNumber].includes(Number(match[1]))) {
    throw new Error("Select a top-level comment on this Issue or its PR");
  }
  const comment = JSON.parse(command("gh", ["api", `repos/${repo}/issues/comments/${match[2]}`]));
  if (comment.html_url !== url || !comment.issue_url.endsWith(`/issues/${match[1]}`)
      || typeof comment.body !== "string" || comment.body.startsWith("Prepared by Daqin automation")) {
    throw new Error("Feedback source differs from the selected comment or is controller output");
  }
  return { url, body: comment.body as string, updatedAt: comment.updated_at as string, author: comment.user.login as string };
}

export function findPr(repo: string, branch: string): PullRequest | undefined {
  const prs: PullRequest[] = JSON.parse(command("gh", ["pr", "list", "--repo", repo,
    "--head", branch, "--state", "all", "--json", "number,url,state,isDraft,headRefOid,baseRefName"]));
  if (prs.length > 1) throw new Error("Multiple PRs exist for the task branch; human reconciliation required");
  return prs[0];
}

export function publishDraft(repo: string, branch: string, base: string, title: string, bodyFile: string): PullRequest {
  let pr = findPr(repo, branch);
  if (pr && (pr.state !== "OPEN" || !pr.isDraft || pr.baseRefName !== base)) {
    throw new Error("Existing PR is ended, ready for review or targets another base; publication stopped");
  }
  if (!pr) {
    try {
      command("gh", ["pr", "create", "--repo", repo, "--head", branch, "--base", base,
        "--draft", "--title", title, "--body-file", bodyFile]);
    } catch {
      // A missing response is not proof that creation failed. Query once, never blindly retry.
      pr = findPr(repo, branch);
      if (!pr) throw new Error("PR creation outcome uncertain; reconcile on GitHub before retrying");
    }
    pr ??= findPr(repo, branch);
  } else {
    command("gh", ["pr", "edit", String(pr.number), "--repo", repo, "--title", title, "--body-file", bodyFile]);
  }
  if (!pr || pr.state !== "OPEN" || !pr.isDraft || pr.baseRefName !== base) throw new Error("Draft PR publication could not be confirmed");
  return pr;
}
