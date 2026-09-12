---
title: 'Connection indicator hydration needs a deterministic initial state'
severity: 'minor'
---

## Expected Behavior
The connection indicator renders identically on the server and during browser hydration.

## Current Behavior
The first implementation of client-only useFetch rendered idle on the server and pending on the client, producing hydration warnings in its badge and refresh button. Fixed before stage-zero acceptance by setting immediate: false and refreshing in onMounted.

## Possible Solution
Keep the initial state deterministic. Start client-only connection reads after mounting and verify console output on a fresh navigation.

## Minimal Reproducible Example
Load apps/factory with a client-only useFetch whose pending status controls server-rendered button attributes.

## Context
Caught during stage-zero browser verification. The source fix is in apps/factory/app/app.vue. This is a project integration lesson, not a claim of an upstream Nuxt defect.
