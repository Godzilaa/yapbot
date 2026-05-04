# Discord Neo4j Project Manager Bot

This scaffold follows the Neo4j memory design in `docs/superpowers/specs/2026-05-04-discord-bot-neo4j-memory-design.md`.

Neo4j stores structured meeting meaning: users, teams, interests, meetings, tasks, decisions, risks, topics, task updates, and relationships. Raw audio and full transcripts stay outside the graph.

## Quick Start

```bash
npm install
cp .env.example .env
npm run neo4j:migrate
npm run sample:ingest
```

## Neo4j Cloud

This project is ready for Neo4j Aura/cloud. In `.env`, set:

```bash
NEO4J_URI=neo4j+s://your-aura-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-aura-password
NEO4J_DATABASE=neo4j
```

For local development only, you can still run:

```bash
docker compose up -d neo4j
```

To run the Discord bot:

```bash
npm run discord:register
npm run dev
```

The `/meeting start` and `/meeting end` flow collects text messages in the active Discord channel. Enable the Message Content Intent for your bot in the Discord Developer Portal, otherwise Discord will not send message text to the bot.

## Current Scope

Implemented scaffold:

- Neo4j schema migrations for graph memory.
- Typed extraction contract with validation.
- Configurable LLM extraction layer using an OpenAI-compatible chat completions API.
- Graph repository and trusted query service.
- Transcript ingestion pipeline using real LLM extraction or structured sample JSON.
- Discord slash command shell for tasks, decisions, missed meetings, summaries, and task updates.
- Text meeting sessions with `/meeting start` and `/meeting end`.
- Sample ingestion script and fixture.

Still intentionally stubbed:

- Discord voice capture.
- Speech-to-text.
- Human confirmation UI for low-confidence extraction.

Those are isolated behind services so they can be added in later phases.

## LLM Extraction

By default the bot runs with `LLM_PROVIDER=stub`, which creates the meeting but extracts no tasks or decisions. To enable real extraction:

```bash
LLM_PROVIDER=openai-compatible
LLM_API_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=your-api-key
LLM_MODEL=your-model-name
```

Any provider that supports the `/chat/completions` shape can be used by changing `LLM_API_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL`.

## Meeting Sessions

Use this flow in a meeting text channel:

```text
/meeting start title:Backend sync project:AI Project Manager Bot
```

The bot buffers non-bot text messages in that channel. When the meeting is done:

```text
/meeting end
```

The bot sends the accumulated transcript through the configured extractor and writes the structured memory to Neo4j.
