---
title: 'Nuxt UI USelect rejects readonly item arrays at typed component boundaries'
severity: 'minor'
---

## Expected Behavior

Component props can expose readonly option arrays while preserving type-safe one-way data flow into USelect.

## Current Behavior

The current Nuxt UI USelect typings reject readonly string or object arrays with TS2322 because ArrayOrNested<SelectItem> expects a mutable array.

## Possible Solution

Accept readonly SelectItem arrays in USelect props, or document the required local clone at the rendering boundary.

## Minimal Reproducible Example

A child component with `items: readonly string[]` passes `:items="items"` to USelect and `pnpm --filter @jira-clone/jira typecheck` fails.

## Context

Observed while extracting Jira list, board, filter, account, and create-form components in the Nuxt 4 app. The workaround is `computed(() => [...props.items])`; no runtime behavior is affected.
