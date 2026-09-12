# Cockpit API

The cockpit exposes the capabilities used by its UI as HTTP endpoints. Start with `GET /api/cockpit`; it is a small, versioned manifest containing the read-only project context and links to every stateful operation.

The deployment is protected by the same project boundary as the cockpit. The API does not accept a repository name, GitHub URL or provider token from the caller.

## Read-only context

```sh
curl https://adeo-factory-cockpit.vercel.app/api/cockpit
```

The response includes the four cockpit sections, the six factory stages, the four project-knowledge references and the three starter requests. It also describes the GitHub, draft, issue-review and Eve investigation endpoints.

`GET /api/github` remains the live repository-connection check. It reads only `software-factory-workshop/jira-clone` through Vercel Connect and returns an unavailable response without provider details when the connection cannot be used.

## Drafts

Drafts remain caller-owned to preserve the product's current browser-local behavior. The API validates and applies the same state transitions, then returns the next collection. It does not claim to provide shared persistence.

Save or replace a draft at the front of a collection:

```sh
curl -X POST https://adeo-factory-cockpit.vercel.app/api/cockpit/drafts \
  -H 'Content-Type: application/json' \
  -d '{"draft":{"title":"An issue list","request":"Inspect KAN"},"drafts":[]}'
```

Restore or normalize a collection with `PUT /api/cockpit/drafts` and `{ "drafts": [...] }`. Remove one with `DELETE /api/cockpit/drafts/{id}` and the same body. Invalid entries are discarded, valid collections are limited to 30 drafts, and server-generated IDs/timestamps are used when a new draft does not provide an ID.

## Human review link

`POST /api/cockpit/issue-link` accepts `{ "title": "...", "request": "..." }` and returns a URL for a prefilled issue in the fixed workshop repository. The API never submits the issue.

## Investigations

Task mining uses Eve's authenticated durable HTTP API directly:

- `POST /eve/v1/session` starts an investigation.
- `POST /eve/v1/session/{sessionId}` sends a follow-up or `inputResponses` answer.
- `GET /eve/v1/session/{sessionId}/stream` reconnects to progress and the stored result.
- `POST /eve/v1/session/{sessionId}/cancel` requests cooperative cancellation.
- `POST /eve/v1/session/{sessionId}/reset` retires a session before a new investigation.

The Eve channel owns authentication, session ownership, streaming and durable execution. The cockpit manifest links to this contract instead of creating a second, weaker session API.

## What remains presentation state

Changing tabs, focusing the editor, selecting a reference and opening an external link do not change shared product state. The manifest exposes the data and stateful operations behind those views; clients may render those presentation choices however they prefer.
