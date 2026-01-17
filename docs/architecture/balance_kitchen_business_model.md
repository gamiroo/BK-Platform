# Balance Kitchen — Business Model

(Content, Lifecycle, Pricing & Service Model)

> This document defines the **authoritative business model and customer lifecycle** that governs content, UX, pricing logic, subscriptions, credits, and service behaviour across the Balance Kitchen platform.
>
> It reflects **current operational reality** and **future platform intent**, and must be treated as a **policy document**, not a marketing artefact.

This document aligns with:

- `balance.md`
- `balance_kitchen_architecture.md`
- `balance_kitchen_tokens.md`
- `balance_kitchen_toolkit.md`

---

## 1. Business Overview

**Balance Kitchen (BK)** is a **premium, relationship‑led meal‑prep service** designed for individuals and teams who prioritise:

- Health
- Consistency
- Time efficiency
- Professional reliability

BK is **not a transactional marketplace**.
It is a **long‑term lifestyle service** with a permanent human account‑management layer.

**Design implication**  
Calm, confident, editorial. No urgency mechanics. No gimmicks.

---

## 2. Customer Engagement Model

### 2.1 Entry & Relationship Model

Customers do **not self-serve signup**.

**Cancellation policy:**

Customers do **not self-cancel orders**.

All cancellations are handled by an Account Manager, preserving the relationship-led service model.
Future self-service cancellation may be enabled via consumable vouchers as a subscription entitlement.

Initial engagement occurs via:

- Instagram
- Facebook Messenger

An **Account Manager (AM)** is the primary interface during onboarding and throughout the customer lifecycle.

This relationship-first model is intentional and permanent.

**Future implementation**  
In the future, Balance Kitchen will introduce an internally built, **Discord-style chat system**. Primary customer contact will originate through the marketing site via a structured chat funnel. This system will become the main relationship surface and a key area where **gamification experiences are delivered and enhanced**.

---

### 2.2 Onboarding & Data Capture

During onboarding, the Account Manager captures:

- Account identity details
- Delivery information
- Culinary preferences
- Special constraints
- Paid preference modifiers (see Section 5)

**Current tools:**

- Zoho CRM (in migration)
- Manual workflows (legacy)

**Policy**  
Preferences are not cosmetic — some preferences directly affect pricing and service level.

**Future implementation**  
The final stage of migration will transition all onboarding, preference management, and account data into a **fully internal Balance Kitchen system**, replacing external CRM dependencies.

---

## 3. Customer Lifecycle (Authoritative)

Balance Kitchen operates on a **state‑based lifecycle**, not a funnel.

```diagram
Visitor
  ↓
Conversation with Account Manager
  ↓
Manual Onboarding (CRM)
  ↓
Custom Quote
  ↓
Pack Purchase
  ↓
Subscription Applied
  ↓
Weekly Ordering Loop
  ↓
Meal Consumption
  ↓
Subscription Auto‑Pause / Reactivation / Cancellation
```

This lifecycle governs **all surfaces and systems**.

---

## 4. Packs, Meals & Credits

### 4.1 Packs (Economic Primitive)

- Customers purchase **packs of meals**
- Packs are exhaustible
- Current constraints:
  - Minimum: 10 meals
  - Maximum: 80 meals

**Base pricing:**

- 300g meal → from $13
- 400g meal → from $15

Packs govern **account activity** and **subscription validity**.

**Integrity guarantee:**

Pack state, ordering constraints (one order/week), and entitlement records are enforced structurally via canonical database constraints defined in `balance_kitchen_schema.md`.
This prevents silent entitlement drift.

---

### 4.2 Credits (System Representation)

Internally, packs represent **purchased meal credits**, even if not yet exposed in the UI.

**Policy distinction:**

- **Purchased credits** (pack‑derived): refundable under defined conditions
- **Earned credits** (future gamification): never refundable

This distinction is mandatory for future implementation.

### 4.3 Credit Classes (Locked vs Unlocked)

BK uses two credit classes:

- **Locked credits** (pack-backed)
  - Represent the internal accounting of meal value within a pack
  - Decrement as meals are ordered (packs consume locked credits)
  - Expire when the pack reaches zero

- **Unlocked credits** (spendable entitlements)
  - Are not used to purchase meals
  - Are exchanged for reward-shop items and vouchers (future)
  - Earned/unlocked credits expire after 12 months

**Conversion rule (locked):**
Locked credits may be unlocked by the customer (future), which decrements pack meal count.  
Unlocked credits can never become locked credits.

---

## 5. Reward Shop (Future)

The Reward Shop allows customers to exchange **unlocked credits** for **items** stored in a personal inventory.

Reward Shop items (vouchers, tokens, etc.) are stored as inventory records per customer account (see `balance_kitchen_schema.md`).
Items authorize actions; they do not modify pack economics directly.

Examples of items:

- Late-order vouchers (48 hours)
- Cancellation vouchers (future)
- Meal tokens (future; separate from packs)
- Food item vouchers (future)

Rules:

- Only **unlocked credits** may be spent
- Purchases are **non-refundable**
- The Reward Shop must remain lightly positive, never urgent, and never tied to core economic pressure
- Items authorize actions; they do not change pack economics directly

---

## 6. Preferences & Pricing Governance

### 6.1 Preference Editability

**Policy**  
Preferences may be edited at any time.

---

### 6.2 Preference Effective Date

**Policy**  
Preference changes apply **on the next subscription renewal**.  
They never apply mid‑pack.

This protects pricing integrity and operational forecasting.

---

### 6.3 Paid Preference Modifiers (Current)

The following may affect pricing and/or service level:

1. Delivery
2. Extra protein, carbs, vegetables, or sauces
3. Specific ingredient constraints (e.g. “X only”)
4. Customised plans
5. Urgent delivery
6. Urgent menu orders
7. AMX (Account Manager Xpress)

These modifiers are **transitional** and will be absorbed into subscription tiers.

---

## 7. Subscriptions (Service Layer)

### 7.1 Role of Subscriptions

Subscriptions do **not replace packs**.

They define:

- Service level
- Customisation depth
- Urgency allowances
- Support entitlements
- Account Manager priority (AMX)

**Key distinction:**

- Packs = inventory
- Subscriptions = entitlements

**Promotional entitlements:**

Subscriptions may include promotional entitlement grants (e.g. bonus credits).
Promo credits are granted as **unlocked credits** and are not used to purchase meals.

Example:

- A mid-tier subscription may grant **+10 promotional credits** per billing period.

These grants:

- are entitlement-based (not meals)
- must be auditable
- must reconcile with refunds or subscription reversal
- are never silently applied

Promo entitlements are a policy mechanism and are enforced by Ordering and Credits (when implemented).

---

### 7.2 Subscription Activity Rules (Locked)

**Authoritative policy:**

- A subscription is **active only while meals remain**
- When meals reach zero:
  - Subscription is **auto‑paused**
  - Pause duration: **7 days**
- If not reactivated within 7 days:
  - Subscription is **cancelled**
  - Removed from the account

This prevents orphaned subscriptions and billing drift.

---

## 8. AMX — Account Manager Xperience

AMX is a **service entitlement**, not a standalone product.

It may be:

- Partially exposed in a mid‑tier subscription
- Fully unlocked in the highest tier

AMX may include:

- Priority handling
- Enhanced support
- Feature previews
- Invitations
- Samples and early releases

AMX is modeled as an **entitlement bundle**.

---

## 9. Weekly Ordering Model

### 9.1 Menu Structure

Menus are category-based:

- Keto
- Carnivore
- Balanced
- Vegetarian

Each category contains approximately **6–8 dishes**.

---

### 9.2 Preset-Driven Meal Layouts (Subscription Entitlement)

For **mid-tier and high-tier subscriptions**, Balance Kitchen supports **preset dish layouts**.

Preset dish layouts allow customers to define, in advance, **how vegetables and carbohydrates are distributed across meals**, removing the need for repeated manual configuration during weekly ordering.

**Key characteristics**:

- Presets are configured during onboarding or via account settings
- Presets may be configured with or without Account Manager assistance
- Presets use **percentage-based distribution rules** (e.g. 50/50, 75/25)
- The system automatically resolves exact quantities based on order size

**Example**:

- Customer orders 6 meals
- Preset layout: 50% Layout A / 50% Layout B
- Result:
  - 3 meals receive Vegetable + Carb set A
  - 3 meals receive Vegetable + Carb set B

The customer only specifies the percentage split. All per-meal allocation is resolved automatically using stored preferences.

Presets are **persistent**, reusable, and editable.

---

### 9.3 Tier-Based Ingredient Access

Vegetable and carbohydrate availability is governed by subscription tier:

- **Base tier**: fixed or limited default selections
- **Mid-tier**: expanded selection (normal + limited premium options)
- **High-tier**: full ingredient selection

Ingredient access is enforced silently during allocation and never presented as punitive restrictions during ordering.

---

### 9.4 Weekly Ordering Flow (Customer-Facing)

Weekly ordering follows a **guided, low-friction flow**:

1. Choose dishes
2. Choose quantities per dish
3. Preset layouts are automatically applied
4. Optional per-dish overrides (if enabled by tier)
5. Review summary and confirm

The default experience requires **no per-meal configuration** once presets are established.

---

### 9.5 Ordering Window

- Opens: **Friday 12:00 PM**
- Closes: **Monday 12:00 AM**

Ordering occurs once per week in a predictable cadence.

---

### 9.6 Missed Cut-Off Policy

**Current:**

- Orders may be accepted after close
- Decision is at Account Manager discretion
- Additional charge may apply

**Future:**

- Customers may use a **voucher**
- Voucher allows ordering **within 48 hours after close**
- Voucher is consumable and time-bound

Exceptions are supported, but never normalised as core behaviour.

### 9.7 Voucher Policies (Reward Shop Items)

- **Late-order voucher:** extends ordering eligibility by **48 hours** after the standard cutoff.
- **Cancellation voucher (future):** allows self-cancellation of an order in `CONFIRMED` state only, and only **before production cutoff**.
- Reward vouchers are consumed on redemption and must be auditable.

### 9.8 Ordering Authority & Locking

- Customers may place **one order per week**
- Orders are editable until confirmed
- Orders become operationally locked at the kitchen production cutoff
- Customers cannot self-cancel orders
- All cancellations and late-order exceptions are handled by Account Managers

---

## 10. Fulfilment & Delivery

- BK uses **in‑house delivery**
- Delivery status is informational, not celebratory
- Urgent delivery may be available as a paid entitlement

---

## 11. Platform Surfaces & Tone

### Marketing

- Trust‑building
- Lifestyle‑led
- Calm, Australian‑casual
- Primary CTA: **Request Access**

### Client Dashboard (Future)

- Operational clarity
- Credit visibility
- Weekly ordering
- Subscription state

### Admin Dashboard

- Control and oversight
- Exception handling
- Pricing, entitlements, lifecycle state

---

## 12. What Balance Kitchen Is Not

Balance Kitchen is not:

- A discount food service
- A fitness influencer brand
- A gamified points app
- A loud or novelty‑driven platform

This explicitly forbids:

- Gradients
- Decorative colour
- Urgency CTAs
- Gamification of core economic state

---

## 13. Extensibility Intent

This model supports:

- Gamification layered on top (not core)
- Multiple brands
- Enterprise accounts
- Additional lifestyle services

Core lifecycle rules must not be bypassed.

---

## 14. Governance

Any change to:

- Packs
- Subscriptions
- Credits
- Preferences
- Colour usage

Requires updating:

- `balance_kitchen_business_model.md`
- `balance_kitchen_tokens.md`
- `balance_kitchen_toolkit.md`

Using the mandatory notification sentence.
