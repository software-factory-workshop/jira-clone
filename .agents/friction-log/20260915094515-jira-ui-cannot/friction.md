---
title: 'Jira UI cannot select boards created through REST or MCP'
severity: 'major'
---

## Expected Behavior
Created boards are selectable in the Jira UI.

## Current Behavior
The UI hardcodes ADEO demo and only toggles List or Board. It does not load the board-list API or retain a board id, so REST/MCP-created boards cannot be selected.

## Possible Solution
Load the board list and add an accessible selector while retaining the KAN project boundary.

## Minimal Reproducible Example
Create a board through MCP, open the Jira UI, and observe no selector.

## Context
Production commit 5d76a2c includes PR 168 backend board APIs but no UI integration.
