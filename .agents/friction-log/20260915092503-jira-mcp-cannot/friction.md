---
title: 'Jira MCP cannot create or list boards'
severity: 'major'
---

## Expected Behavior

MCP clients can create a bounded kanban or scrum board for the demo KAN project and list it afterward.

## Current Behavior

On `origin/main` a64285a, `/mcp` exposes issue and comment reads/writes but has no board entity, persistence, REST route, `createBoard`, or `listBoards` tool.

## Possible Solution

Add bounded memory and Neon board persistence, Jira Agile-style list/create routes, and authorized MCP `listBoards` and `createBoard` tools.

## Minimal Reproducible Example

Call `tools/list` on `/mcp` and observe that `createBoard` and `listBoards` are absent, so no board-creation tool call is possible.

## Context

This blocks MCP and Vercel Connect clients from completing a board-creation workflow. Local branch `fix/mcp-create-board` implements and verifies the proposed path; `pnpm check` and a live MCP create/list round trip pass.
