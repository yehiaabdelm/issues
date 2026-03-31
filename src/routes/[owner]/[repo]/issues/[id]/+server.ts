import type { RequestHandler } from '@sveltejs/kit';

interface GitHubUser {
	login: string;
	html_url: string;
}

interface GitHubLabel {
	name: string;
	color: string;
}

interface GitHubReactions {
	total_count: number;
	'+1': number;
	'-1': number;
	laugh: number;
	hooray: number;
	confused: number;
	heart: number;
	rocket: number;
	eyes: number;
}

interface GitHubIssue {
	number: number;
	title: string;
	html_url: string;
	user: GitHubUser;
	state: string;
	created_at: string;
	updated_at: string;
	closed_at: string | null;
	labels: GitHubLabel[];
	body: string | null;
	comments: number;
	reactions: GitHubReactions;
}

interface GitHubComment {
	id: number;
	html_url: string;
	user: GitHubUser;
	created_at: string;
	updated_at: string;
	body: string | null;
	reactions: GitHubReactions;
	author_association: string;
}

function formatDate(iso: string): string {
	return new Date(iso).toISOString().slice(0, 10);
}

function reactionSummary(r: GitHubReactions): string {
	const parts: string[] = [];
	if (r['+1']) parts.push(`👍 ${r['+1']}`);
	if (r['-1']) parts.push(`👎 ${r['-1']}`);
	if (r.laugh) parts.push(`😄 ${r.laugh}`);
	if (r.hooray) parts.push(`🎉 ${r.hooray}`);
	if (r.confused) parts.push(`😕 ${r.confused}`);
	if (r.heart) parts.push(`❤️ ${r.heart}`);
	if (r.rocket) parts.push(`🚀 ${r.rocket}`);
	if (r.eyes) parts.push(`👀 ${r.eyes}`);
	return parts.join('  ');
}

function issueToMarkdown(issue: GitHubIssue, comments: GitHubComment[]): string {
	const lines: string[] = [];

	lines.push(`# ${issue.title}`);
	lines.push('');

	const meta: string[] = [
		`**#${issue.number}** · ${issue.state === 'open' ? '🟢 Open' : '🔴 Closed'}`,
		`**Author:** [@${issue.user.login}](${issue.user.html_url})`,
		`**Created:** ${formatDate(issue.created_at)}`,
		`**Updated:** ${formatDate(issue.updated_at)}`
	];
	if (issue.closed_at) meta.push(`**Closed:** ${formatDate(issue.closed_at)}`);
	if (issue.labels.length) {
		meta.push(`**Labels:** ${issue.labels.map((l) => `\`${l.name}\``).join(', ')}`);
	}
	meta.push(`**Source:** [View on GitHub](${issue.html_url})`);

	lines.push(meta.join('  \n'));
	lines.push('');

	if (issue.reactions.total_count) {
		lines.push(reactionSummary(issue.reactions));
		lines.push('');
	}

	lines.push('---');
	lines.push('');
	lines.push(issue.body ?? '_No description provided._');
	lines.push('');

	if (comments.length) {
		lines.push('---');
		lines.push('');
		lines.push(`## Comments (${comments.length})`);
		lines.push('');

		for (const comment of comments) {
			lines.push(
				`### [@${comment.user.login}](${comment.user.html_url}) — ${formatDate(comment.created_at)}`
			);
			if (comment.created_at !== comment.updated_at) {
				lines.push(`_edited ${formatDate(comment.updated_at)}_`);
			}
			lines.push('');
			lines.push(comment.body ?? '_No content._');
			lines.push('');
			if (comment.reactions.total_count) {
				lines.push(reactionSummary(comment.reactions));
				lines.push('');
			}
			lines.push(`[View comment](${comment.html_url})`);
			lines.push('');
			lines.push('---');
			lines.push('');
		}
	}

	return lines.join('\n');
}

async function fetchGitHub(url: string): Promise<Response> {
	return fetch(url, { headers: { 'User-Agent': 'github.yehiaabdelm.com' } });
}

export const GET: RequestHandler = async ({ params, platform }) => {
	const { owner, repo } = params;
	const id: string = params.id ?? '';

	if (!/^\d+$/.test(id)) {
		return new Response('Invalid issue number', { status: 400 });
	}

	const apiBase = `https://api.github.com/repos/${owner}/${repo}/issues/${id}`;

	const [issueRes, commentsRes] = await Promise.all([
		fetchGitHub(apiBase),
		fetchGitHub(`${apiBase}/comments?per_page=100`)
	]);

	if (!issueRes.ok) {
		console.log(`GitHub API error: ${issueRes.status} ${issueRes.statusText} for ${apiBase}`);;
		const status = issueRes.status === 404 ? 404 : 502;
		return new Response(
			status === 404 ? `Issue ${owner}/${repo}#${id} not found` : 'GitHub API error',
			{ status }
		);
	}

	const issue: GitHubIssue = await issueRes.json();
	const comments: GitHubComment[] = commentsRes.ok ? await commentsRes.json() : [];

	const cacheControl = 'public, max-age=300, stale-while-revalidate=3600';

	const markdown = issueToMarkdown(issue, comments);
	return new Response(markdown, {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			'Cache-Control': cacheControl
		}
	});
};
