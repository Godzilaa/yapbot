# Discord Neo4j Project Manager Bot

This scaffold follows the Neo4j memory design in `docs/superpowers/specs/2026-05-04-discord-bot-neo4j-memory-design.md`.

Neo4j stores structured meeting meaning: users, teams, interests, meetings, tasks, decisions, risks, topics, task updates, and relationships. Raw audio and full transcripts stay outside the graph.

## Quick Start

```bash
npm install
cp .env.example .env
docker compose up -d neo4j
npm run neo4j:migrate
npm run sample:ingest
```

To run the Discord bot:

```bash
npm run discord:register
npm run dev
```

## Current Scope

Implemented scaffold:

- Neo4j schema migrations for graph memory.
- Typed extraction contract with validation.
- Graph repository and trusted query service.
- Transcript ingestion pipeline using structured extraction JSON.
- Discord slash command shell for tasks, decisions, missed meetings, summaries, and task updates.
- Sample ingestion script and fixture.

Still intentionally stubbed:

- Real LLM extraction.
- Discord voice capture.
- Speech-to-text.
- Human confirmation UI for low-confidence extraction.

Those are isolated behind services so they can be added in later phases.
