CREATE TABLE "account_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_type" text NOT NULL,
	"status" text NOT NULL,
	"primary_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"livemode" boolean NOT NULL,
	"payload_json" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"process_status" text NOT NULL,
	"failure_reason" text,
	"processing_started_at" timestamp with time zone,
	"processing_attempts" integer DEFAULT 0 NOT NULL,
	"last_error_code" text,
	CONSTRAINT "billing_events_process_status_check" CHECK ("billing_events"."process_status" in ('RECEIVED','PROCESSED','FAILED')),
	CONSTRAINT "billing_events_processing_attempts_check" CHECK ("billing_events"."processing_attempts" >= 0),
	CONSTRAINT "billing_events_processed_at_check" CHECK ("billing_events"."processed_at" is null or "billing_events"."processed_at" >= "billing_events"."received_at"),
	CONSTRAINT "billing_events_processing_started_at_check" CHECK ("billing_events"."processing_started_at" is null or "billing_events"."processing_started_at" >= "billing_events"."received_at")
);
--> statement-breakpoint
CREATE TABLE "billing_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"billing_transaction_id" uuid NOT NULL,
	"line_type" text NOT NULL,
	"stripe_price_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"bk_reference_type" text NOT NULL,
	"bk_reference_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_line_items_line_type_check" CHECK ("billing_line_items"."line_type" in ('PACK','SUBSCRIPTION','CREDITS_TOPUP')),
	CONSTRAINT "billing_line_items_quantity_check" CHECK ("billing_line_items"."quantity" > 0),
	CONSTRAINT "billing_line_items_bk_reference_type_check" CHECK ("billing_line_items"."bk_reference_type" in ('PACK_PRODUCT','SUBSCRIPTION_PLAN')),
	CONSTRAINT "billing_line_items_type_pairing_check" CHECK ((
        ("billing_line_items"."line_type" = 'PACK' and "billing_line_items"."bk_reference_type" = 'PACK_PRODUCT')
        or
        ("billing_line_items"."line_type" = 'SUBSCRIPTION' and "billing_line_items"."bk_reference_type" = 'SUBSCRIPTION_PLAN')
        or
        ("billing_line_items"."line_type" = 'CREDITS_TOPUP' and "billing_line_items"."bk_reference_type" in ('PACK_PRODUCT','SUBSCRIPTION_PLAN'))
      ))
);
--> statement-breakpoint
CREATE TABLE "billing_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"billing_transaction_id" uuid NOT NULL,
	"stripe_refund_id" text NOT NULL,
	"stripe_charge_id" text,
	"amount_cents" bigint NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_refunds_amount_check" CHECK ("billing_refunds"."amount_cents" > 0),
	CONSTRAINT "billing_refunds_status_check" CHECK ("billing_refunds"."status" in ('PENDING','SUCCEEDED','FAILED'))
);
--> statement-breakpoint
CREATE TABLE "billing_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"stripe_object_type" text NOT NULL,
	"stripe_object_id" text NOT NULL,
	"purpose" text NOT NULL,
	"kind" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_invoice_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_transactions_object_type_check" CHECK ("billing_transactions"."stripe_object_type" in ('checkout_session','invoice','payment_intent','charge','refund')),
	CONSTRAINT "billing_transactions_purpose_check" CHECK ("billing_transactions"."purpose" in ('PACK_PURCHASE','SUBSCRIPTION_PAYMENT','CREDITS_TOPUP','OTHER')),
	CONSTRAINT "billing_transactions_kind_check" CHECK ("billing_transactions"."kind" in ('CHARGE','REFUND','ADJUSTMENT')),
	CONSTRAINT "billing_transactions_status_check" CHECK ("billing_transactions"."status" in ('SUCCEEDED','PENDING','FAILED')),
	CONSTRAINT "billing_transactions_amount_check" CHECK ("billing_transactions"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "customer_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"preferences_json" jsonb NOT NULL,
	"effective_from_period_start" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"name" text,
	"email" text,
	"phone" text,
	"message" text NOT NULL,
	"status" text NOT NULL,
	"assigned_to_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"surface" text NOT NULL,
	"auth_level" text DEFAULT 'AAL1' NOT NULL,
	"session_family_id" uuid NOT NULL,
	"rotation_counter" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_reason" text,
	"user_agent_snapshot" text,
	"device_id_hash" text,
	"ip_created" "inet",
	CONSTRAINT "sessions_surface_check" CHECK ("sessions"."surface" in ('client','admin')),
	CONSTRAINT "sessions_auth_level_check" CHECK ("sessions"."auth_level" in ('AAL1','AAL2','AAL3')),
	CONSTRAINT "sessions_rotation_counter_check" CHECK ("sessions"."rotation_counter" >= 0),
	CONSTRAINT "sessions_revoked_at_check" CHECK ("sessions"."revoked_at" is null or "sessions"."revoked_at" <= now())
);
--> statement-breakpoint
CREATE TABLE "subscription_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"preset_access" boolean DEFAULT false NOT NULL,
	"override_access" boolean DEFAULT false NOT NULL,
	"override_allowance" integer DEFAULT 0 NOT NULL,
	"override_used" integer DEFAULT 0 NOT NULL,
	"promo_unlocked_credits_grant" integer DEFAULT 0 NOT NULL,
	"event_type" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_user_id" uuid,
	"metadata_json" jsonb,
	"billing_transaction_id" uuid,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_entitlements_period_check" CHECK ("subscription_entitlements"."period_end" > "subscription_entitlements"."period_start"),
	CONSTRAINT "subscription_entitlements_override_check" CHECK ("subscription_entitlements"."override_used" <= "subscription_entitlements"."override_allowance")
);
--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"billing_event_id" uuid,
	"billing_transaction_id" uuid,
	"event_type" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_user_id" uuid,
	"idempotency_key" text NOT NULL,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_events_event_type_check" CHECK ("subscription_events"."event_type" in (
        'SUBSCRIPTION_CREATED',
        'SUBSCRIPTION_CHECKOUT_STARTED',
        'SUBSCRIPTION_CHECKOUT_COMPLETED',
        'SUBSCRIPTION_INVOICE_PAID',
        'SUBSCRIPTION_INVOICE_PAYMENT_FAILED',
        'SUBSCRIPTION_PAUSED',
        'SUBSCRIPTION_RESUMED',
        'SUBSCRIPTION_CANCEL_REQUESTED',
        'SUBSCRIPTION_CANCELLED',
        'SUBSCRIPTION_PROVIDER_UPDATED',
        'SUBSCRIPTION_ENTITLEMENTS_GRANTED'
      )),
	CONSTRAINT "subscription_events_billing_link_check" CHECK ("subscription_events"."billing_event_id" is null or "subscription_events"."billing_transaction_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_plan_id" text NOT NULL,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_status_check" CHECK ("subscription_plans"."status" in ('ACTIVE','RETIRED'))
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"provider_subscription_id" text,
	"provider_customer_id" text,
	"status" text NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"auto_pause_on_pack_zero" boolean DEFAULT true NOT NULL,
	"paused_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"resume_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_status_check" CHECK ("subscriptions"."status" in ('INCOMPLETE','ACTIVE','PAST_DUE','PAUSED','CANCELLED')),
	CONSTRAINT "subscriptions_periods_required_check" CHECK (("subscriptions"."status" not in ('ACTIVE','PAST_DUE','PAUSED'))
          or ("subscriptions"."current_period_start" is not null and "subscriptions"."current_period_end" is not null)),
	CONSTRAINT "subscriptions_resume_only_when_paused_check" CHECK ("subscriptions"."resume_at" is null or "subscriptions"."status" = 'PAUSED'),
	CONSTRAINT "subscriptions_cancel_at_period_end_cancelled_check" CHECK ("subscriptions"."status" != 'CANCELLED' or "subscriptions"."cancel_at_period_end" = false)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"display_name" text,
	"password_hash" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_line_items" ADD CONSTRAINT "billing_line_items_billing_transaction_id_billing_transactions_id_fk" FOREIGN KEY ("billing_transaction_id") REFERENCES "public"."billing_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_refunds" ADD CONSTRAINT "billing_refunds_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_refunds" ADD CONSTRAINT "billing_refunds_billing_transaction_id_billing_transactions_id_fk" FOREIGN KEY ("billing_transaction_id") REFERENCES "public"."billing_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_preferences" ADD CONSTRAINT "customer_preferences_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_entitlements" ADD CONSTRAINT "subscription_entitlements_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_entitlements" ADD CONSTRAINT "subscription_entitlements_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_entitlements" ADD CONSTRAINT "subscription_entitlements_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_entitlements" ADD CONSTRAINT "subscription_entitlements_billing_transaction_id_billing_transactions_id_fk" FOREIGN KEY ("billing_transaction_id") REFERENCES "public"."billing_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_billing_event_id_billing_events_id_fk" FOREIGN KEY ("billing_event_id") REFERENCES "public"."billing_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_billing_transaction_id_billing_transactions_id_fk" FOREIGN KEY ("billing_transaction_id") REFERENCES "public"."billing_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_memberships_user_id_idx" ON "account_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_memberships_account_id_idx" ON "account_memberships" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "accounts_primary_user_id_idx" ON "accounts" USING btree ("primary_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customers_account_unique" ON "billing_customers" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customers_stripe_customer_unique" ON "billing_customers" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_events_stripe_event_livemode_unique" ON "billing_events" USING btree ("stripe_event_id","livemode");--> statement-breakpoint
CREATE INDEX "billing_events_status_received_idx" ON "billing_events" USING btree ("process_status","received_at");--> statement-breakpoint
CREATE INDEX "billing_events_stripe_event_idx" ON "billing_events" USING btree ("stripe_event_id","livemode");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_line_items_unique" ON "billing_line_items" USING btree ("billing_transaction_id","line_type","bk_reference_type","bk_reference_id");--> statement-breakpoint
CREATE INDEX "billing_line_items_tx_idx" ON "billing_line_items" USING btree ("billing_transaction_id");--> statement-breakpoint
CREATE INDEX "billing_line_items_bk_ref_idx" ON "billing_line_items" USING btree ("bk_reference_type","bk_reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_refunds_stripe_refund_unique" ON "billing_refunds" USING btree ("stripe_refund_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_refunds_tx_refund_unique" ON "billing_refunds" USING btree ("billing_transaction_id","stripe_refund_id");--> statement-breakpoint
CREATE INDEX "billing_refunds_account_created_idx" ON "billing_refunds" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "billing_refunds_tx_idx" ON "billing_refunds" USING btree ("billing_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_transactions_object_kind_unique" ON "billing_transactions" USING btree ("stripe_object_type","stripe_object_id","kind");--> statement-breakpoint
CREATE INDEX "billing_transactions_account_occurred_idx" ON "billing_transactions" USING btree ("account_id","occurred_at");--> statement-breakpoint
CREATE INDEX "billing_transactions_customer_idx" ON "billing_transactions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "billing_transactions_subscription_idx" ON "billing_transactions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "customer_preferences_account_id_idx" ON "customer_preferences" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "enquiries_status_idx" ON "enquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "enquiries_assigned_to_user_id_idx" ON "enquiries" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_key_uq" ON "roles" USING btree ("key");--> statement-breakpoint
CREATE INDEX "sessions_user_surface_revoked_idx" ON "sessions" USING btree ("user_id","surface","revoked_at");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_entitlements_unique_period" ON "subscription_entitlements" USING btree ("subscription_id","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_entitlements_idempotency_unique" ON "subscription_entitlements" USING btree ("account_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "subscription_entitlements_sub_period_idx" ON "subscription_entitlements" USING btree ("subscription_id","period_start");--> statement-breakpoint
CREATE INDEX "subscription_entitlements_sub_created_idx" ON "subscription_entitlements" USING btree ("subscription_id","created_at");--> statement-breakpoint
CREATE INDEX "subscription_entitlements_account_created_idx" ON "subscription_entitlements" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_events_idempotency_unique" ON "subscription_events" USING btree ("account_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "subscription_events_sub_created_idx" ON "subscription_events" USING btree ("subscription_id","created_at");--> statement-breakpoint
CREATE INDEX "subscription_events_account_created_idx" ON "subscription_events" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "subscription_events_billing_event_idx" ON "subscription_events" USING btree ("billing_event_id");--> statement-breakpoint
CREATE INDEX "subscription_events_billing_tx_idx" ON "subscription_events" USING btree ("billing_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plans_provider_plan_unique" ON "subscription_plans" USING btree ("provider_plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plans_key_unique" ON "subscription_plans" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_provider_subscription_unique" ON "subscriptions" USING btree ("provider_subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_account_status_idx" ON "subscriptions" USING btree ("account_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");