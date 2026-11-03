# interview-prep-mcp

> **This repo is archived.** Its Investment Banking questions now ship in [ai-interview-questions-mcp](https://github.com/Johnnnmai/ai-interview-questions-mcp) (v1.1.0 and later), which has all 200 questions, the same tools, and a Streamable HTTP mode. Use that package instead.

An MCP server with **200 interview questions and model answers** for two tracks:

- **AI engineer** (100): LLM fundamentals, prompting, RAG, agents and tool use, fine-tuning, evaluation, production, system design, coding
- **Investment banking** (100): accounting, valuation, M&A, LBO, restructuring and current events

Search, browse by topic and level, run mock-interview practice with hidden answers, and get a free self-check link for many questions. Works offline: the question bank ships inside the package (`data/questions.json`). No API key, no account, no network calls at runtime.

Content comes from two free public question banks:

- https://johnnnmai.github.io/ai-engineer-interview-questions/
- https://johnnnmai.github.io/investment-banking-interview-questions/

## Tools

| Tool | What it does |
| --- | --- |
| `search_questions` | Keyword search with optional `track`, `topic`, `level`, `limit`. Returns question ids. |
| `get_question` | One question by id (`aie-12`, `ib-30`) with model answer, likely follow-up and source link. `reveal_answer: false` hides the answer for practice. |
| `random_question` | Random practice question (answer hidden), filterable by track, topic and level. |
| `list_topics` | Tracks and topics with question counts. |

All tools are read-only.

## Install

Requires Node.js 18 or newer.

### Claude Desktop, Cursor, Windsurf and other MCP clients

```json
{
  "mcpServers": {
    "interview-prep": {
      "command": "npx",
      "args": ["-y", "interview-prep-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add interview-prep -- npx -y interview-prep-mcp
```

### From source

```bash
git clone https://github.com/Johnnnmai/interview-prep-mcp.git
cd interview-prep-mcp
npm install
node index.js   # stdio server
npm test        # spawns the server and calls every tool with an MCP client
```

## Example prompts

- "Give me three senior-level RAG interview questions, answers hidden."
- "Quiz me on LBO questions one at a time and grade my answers against the model answer."
- "What is the model answer for aie-46?"

## More practice material

- Free: [AI Engineer Top 30 questions with model answers](https://sirjohnnymai.gumroad.com/l/aie-top-30-questions?utm_source=github&utm_medium=readme&utm_campaign=line27_interview_mcp)
- Free: [Investment Banking Top 30 questions with model answers](https://sirjohnnymai.gumroad.com/l/ib-top-30-questions?utm_source=github&utm_medium=readme&utm_campaign=line27_interview_mcp)
- Free: [Answer self-check](https://johnnnmai.github.io/ai-engineer-interview-questions/answer-check/?utm_source=github&utm_medium=readme&utm_campaign=line27_interview_mcp)
- Paid: [AI Engineer Interview Playbook](https://sirjohnnymai.gumroad.com/l/ai-engineer-interview-playbook?utm_source=github&utm_medium=readme&utm_campaign=line27_interview_mcp)

Tool results include these links at the end, tagged `utm_source=mcp`.

## Refreshing the data

```bash
npm run build:data
```

This re-reads the two public sites and rewrites `data/questions.json`. It is the only step that uses the network.

## License

MIT. Published by Valenx Press.
