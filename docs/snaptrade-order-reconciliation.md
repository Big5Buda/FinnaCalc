# Reconcile submission state without resubmitting

Version3 is a cash-account-only broker-authoritative model for BUY and SELL. Local
cash/share/fee/open-order reads are guardrails; they are not a fixed execution cost,
atomic brokerage snapshot or guarantee against outside/joint-owner activity. The
broker retains final risk, funds and no-short enforcement. No live/paper test order
is part of validation.

## Durable review generation

Before any impact/account/quote/provider work, capture the owner's durable generation
under the owner advisory lock. Creation saves only if that generation still matches
and no submitting/unknown/acknowledged order is reserved. Consume compares the saved
generation to the current one, increments it and invalidates all older reviewing rows
in the same transaction. A slow impact cannot save after a claim or reconciliation,
even if it had no row yet when invalidation ran. Generations are text at the API
boundary to avoid JavaScript bigint precision loss.

## Routine acknowledged orders

Only a complete row with an exact stored acknowledgement brokerageOrderId, current
original client/vendor ownership and stored account can use automatic reconciliation.
A later explicit review request captures generation, checks its owner reservation and
makes at most ONE real-time getUserAccountOrderDetail read for that exact existing
order. It does not place, retry, cancel, refresh or search by a plausible ticker.

Require exact order/listing/action/total quantity/type/time-in-force/limit-price
binding, USD common stock/ETF and no complex/option/stop/trailing payload. Only
EXECUTED with filled quantity equal to total and zero open quantity, or zero-filled
REJECTED/CANCELED/EXPIRED with zero open quantity, qualifies. Unsupported partial,
replaced, pending, missing/mismatched data and provider errors keep the reservation.

A service-role-only owner-locked CAS checks current generation, complete state,
original owner/key/vendor, immutable stored terms/symbol and exact observed result.
It persists the bounded positive detail evidence, marks resolved, increments the
owner generation and invalidates all remaining old reviewing rows atomically. A
second resolver cannot advance it twice. The request restarts at a new generation
BEFORE new business provider reads; no prior account/quote/impact/funds/positions are
reused. A new reviewId and explicit owner confirmation are required for the next
order. Resolving an old order never submits the new one.

This path does not claim generic atomic post-fill snapshot causality. It closes our
stale overlap/save race while relying on new best-available broker reads and the
reviewed cash-account/broker-authority model. Available metadata freshness and
external activity remain limitations, not an invented absolute provider proof gate.

## Ambiguous/manual cases

submitting/unknown never uses the routine resolver, including if a caller supplies
an apparent order ID or time has elapsed. Missing acknowledgements, ambiguous matches,
unsupported partial/replacement cases or conflicting stored identity require the
restricted operator. Native shows history/reconciliation guidance; no blind retry.

An authorized operator must positively identify the existing order using the same
original session/key and exact owner/account/immutable terms. Use authoritative
broker order detail/history evidence and retain its restricted reference; no match,
empty history, absent webhook, cached data, expiry or timeout does not prove no order.
No new public endpoint or broader client permission is introduced.

A manual resolution uses a transaction with the SAME owner advisory lock, a row lock
and CAS on observed state/result/key/vendor/terms/symbol/row generation AND expected
current owner generation. Mark resolved only after the documented positive decision,
store actual broker status and evidence, increment current owner generation exactly
once and invalidate all reviewing rows before commit. Assert exactly one owner and
review row changed; otherwise rollback/reload, never force the update. Never reset a
consumed row to reviewing, delete it or drop the table to unlock an owner. Do not
resubmit or cancel an order as a reconciliation probe.

Designate authorized operators and evidence location before release. Account deletion
currently cascades these rows; apply the real privacy/retention policy rather than
claim this is an eternal audit log. Rollback disables flags, retains durable rows,
and reconciles already-consumed orders; it cannot undo broker execution.

Primary sources checked: [real-time order detail](https://docs.snaptrade.com/reference/Account%20Information/AccountInformation_getUserAccountOrderDetail),
[account details](https://docs.snaptrade.com/reference/Account%20Information/AccountInformation_getAccountDetails),
[syncing](https://docs.snaptrade.com/docs/syncing). No private order reads were used in
research, and tests use isolated fixture stores/transports only.
