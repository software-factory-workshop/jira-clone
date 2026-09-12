---
title: 'Starter selection updates an offscreen editor without feedback'
severity: 'minor'
---

## Expected Behavior
Selecting a starter visibly opens its populated request editor.

## Current Behavior
Starter clicks populated an editor above the viewport while leaving the clicked card in view. The title input was at -203.5px after a click, making the action appear broken. Fixed by scrolling to the editor after Vue updates and focusing its title input.

## Possible Solution
For actions that update another part of a page, move focus and reveal the result. Apply the same behavior to New request and reopening a saved draft.

## Minimal Reproducible Example
Scroll to the starter cards and select A board worth using. Before the fix the fields changed above the visible area.

## Context
Reported by the user with a screenshot. Browser verification of all three starters after the fix found the correct title and brief, title focus, and the input at 125px within a 720px viewport. No browser warnings or errors. Cockpit typecheck and production build pass.
