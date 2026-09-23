---
name: feature-implement
description: Implement the reviewed Skill Studio plan as small, verified slices without scope expansion.
disable-model-invocation: true
---

# Feature implement

Implement the reviewed Skill Studio plan as the smallest complete change.

When the feature crosses several layers, prefer this order and check each slice before the next
layer expands it:

1. Pure domain behavior
2. Persistence or filesystem boundary
3. API or application service
4. UI state and interaction
5. Focused integration evidence

Requirements:

- reuse existing contracts and helpers where semantics match,
- add or update focused tests as behavior changes,
- run the relevant check after each coherent slice,
- preserve trust, privacy, persistence, and accessibility boundaries,
- keep unrelated files unchanged.

Stop and ask before changing the approved outcome, adding infrastructure, migrating data, or crossing
a product boundary.
