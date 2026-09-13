# Third context revision, infrastructure-blocked replay

The model recognizes active work and returns two bounded proposals without duplicating the calibration. However, it could not check GitHub: its inventory input included `number: "null"`, an irrelevant parameter rejected by the original shared schema. The runner correctly exited unsuccessfully with zero GitHub reads. Do not score this as a complete quality run or describe GitHub as empty.

Boundary fix: use separate discriminated input shapes for inventory and comments. Inventory accepts only its resource after Zod strips irrelevant fields. Comment reads still require a positive integer. Add regression tests for the observed string-null case and denied write/alternate-repository inputs. This is a tool-contract correction, not a prompt improvement or broader permission grant. Repeat the same context afterward.

Follow-up: the first discriminated-union schema was rejected by MCP. The final fix uses an object-root schema with conditional comment validation; see report.md and final run evidence.
