# Project model selection

Reviewed on 2026-10-02. This policy selects models for agents working on Codexbot; it does not
change runtime models or installed catalogues. It overrides only the model and effort allocations
in `~/.codex/astra-policy.md`. All other shared controls and the privacy, safety, review and
operation gates in [AGENTS.md](../../AGENTS.md) still apply.

## Model and effort

| Work unit | Model | Effort and selection rule |
| --- | --- | --- |
| Coordination and ordinary project work | `gpt-6.1-sol` | `low` by default. |
| Bounded implementation and investigation | `gpt-6.1-sol` | `medium`; use `high` when complex reasoning justifies it. |
| Independent extraction or mapping | `gpt-6-luna` | `low`, with a bounded, verifiable result. |
| Mechanical changes | `gpt-6-luna` | `medium`, with clear acceptance criteria. |
| High-impact decisions, architecture, auth, security, payments, migration, concurrency or difficult defects | `gpt-6-astra` | `low` for a narrow decision with clear evidence, `medium` for ambiguous investigation, `high` for complex reasoning or interacting risks. |
| Review | Proportional to risk | Mechanical edits: local checks and root review. Logic, integration, auth, payment, migration and concurrency: independent review; use Astra for higher-risk review, with effort chosen as above. |

These are project routing choices, not guarantees of quality or latency. Do not assign Astra to
every simple task. The official [GPT-6.1 Sol documentation](https://developers.openai.com/api/docs/models/gpt-6.1-sol)
describes near-Astra capability at lower API cost and recommends comparison on actual tasks.
[Astra](https://developers.openai.com/api/docs/models/gpt-6-astra) and
[Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) remain options for their roles above.

## Availability and changes

The host reported `gpt-6.1-sol`, `gpt-6-astra`, `gpt-6-sol`, `gpt-6-luna`,
`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna` and `gpt-5.5` on the review date,
including the `low`, `medium` and `high` combinations needed here. Confirm the selected model
and effort on the executing host before dispatch; API identifiers and API support do not establish
Codex host availability, plan eligibility or effective cost.

GPT-6 Sol, GPT-5.6 models (including Terra) and GPT-5.5 are not defaults. Use a fallback only
for unavailability or a concrete task need, verify local model/effort support, and record the reason.
Credit, login, access errors and waiting do not justify a larger model. Change model or effort only
at a new work unit after a concrete need or reasoning/implementation defect is identified; keep
the model and prompt prefixes stable within a unit and never reconfigure an ongoing task
retroactively. No automatic Max/Ultra escalation; `xhigh` needs a concrete justification and local
support. Use Standard by default and Fast only for explicit urgency.

## Execution and review

Resolve simple work in the current agent. Delegate only meaningful independent units: at most
two simultaneous executors, with capacity reserved for review. Use a fresh worktree per chat/task,
serialize overlapping changes, and provide minimal context: objective, files, constraints,
acceptance criteria, authorizations and evidence. When the user requests external execution or
review chats, prefer them; the orchestrator remains responsible for the result and validation.
Do not create extra chats, monitors or schedules without a request. Preserve project-specific
authorizations and confirmations. Independent review must remain independent of implementation.

## Future selection and evidence

On a new release or before changing this policy, confirm current host models/efforts and consult
the official model pages and [model selection guide](https://developers.openai.com/api/docs/guides/model-selection).
Evaluate quality against acceptance criteria, latency and cost by task using measured values or
`null` when unavailable. Report API tariffs only as dated reference prices with their pricing mode
and context conditions; they do not measure Codex plan usage or actual savings. Claim savings
only after a controlled comparison preserves quality. Do not infer that GPT-6.1 Sol has cheaper
input/output than GPT-6 Sol simply because it is newer. This policy creates no monitoring schedule.
