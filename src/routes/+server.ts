import type { RequestHandler } from '@sveltejs/kit';

const markdown = `# github.yehiaabdelm.com

Fetch any GitHub issue as markdown. Just replace \`github.com\` with \`github.yehiaabdelm.com\`.

## Usage

\`\`\`
GET /{owner}/{repo}/issues/{number}  → markdown
\`\`\`

## Example

\`\`\`
https://github.com/facebook/react-native/issues/54181
                  ↓
https://github.yehiaabdelm.com/facebook/react-native/issues/54181
\`\`\`
`;

export const GET: RequestHandler = () => {
	return new Response(markdown, {
		headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
	});
};
