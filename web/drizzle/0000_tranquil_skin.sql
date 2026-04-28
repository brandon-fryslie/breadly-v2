CREATE TYPE "public"."claim_status" AS ENUM('active', 'picked_up', 'cancelled_by_eater', 'cancelled_by_baker', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('scheduled', 'ready', 'claimed', 'picked_up', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."schedule_kind" AS ENUM('one_off', 'recurring');--> statement-breakpoint
CREATE TYPE "public"."tag_kind" AS ENUM('style', 'dietary', 'ingredient', 'process', 'kitchen');--> statement-breakpoint
CREATE TABLE "baker_profiles" (
	"user_id" varchar(64) PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"bakery_name" text NOT NULL,
	"neighborhood" text,
	"bio" text,
	"cover_photo_url" text,
	"pickup_window_text" text,
	"disclaimer_accepted_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"listing_cutoff_hours" integer DEFAULT 24 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "baker_profiles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"eater_id" varchar(64) NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"status" "claim_status" DEFAULT 'active' NOT NULL,
	"pickup_code" varchar(8) NOT NULL,
	"picked_up_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eater_preferences" (
	"user_id" varchar(64) PRIMARY KEY NOT NULL,
	"include_tag_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclude_tag_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"radius_mi" integer DEFAULT 2 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_tags" (
	"listing_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "listing_tags_listing_id_tag_id_pk" PRIMARY KEY("listing_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"baker_id" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"blurb" text,
	"photo_url" text,
	"price_cents" integer NOT NULL,
	"qty_total" integer NOT NULL,
	"qty_available" integer NOT NULL,
	"status" "listing_status" DEFAULT 'scheduled' NOT NULL,
	"ready_at" timestamp with time zone NOT NULL,
	"out_of_oven_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"location" geometry(point) NOT NULL,
	"schedule_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"baker_id" varchar(64) NOT NULL,
	"kind" "schedule_kind" NOT NULL,
	"name" text NOT NULL,
	"blurb" text,
	"photo_url" text,
	"price_cents" integer NOT NULL,
	"default_qty" integer NOT NULL,
	"days_of_week" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"time_of_day" varchar(5),
	"first_ready_at" timestamp with time zone,
	"tag_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"label" text NOT NULL,
	"kind" "tag_kind" NOT NULL,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"can_bake" boolean DEFAULT false NOT NULL,
	"can_operate" boolean DEFAULT false NOT NULL,
	"address_line" text,
	"city" text,
	"region" text,
	"postal_code" text,
	"location" geometry(point),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "baker_profiles" ADD CONSTRAINT "baker_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_eater_id_users_id_fk" FOREIGN KEY ("eater_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eater_preferences" ADD CONSTRAINT "eater_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_tags" ADD CONSTRAINT "listing_tags_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_tags" ADD CONSTRAINT "listing_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_baker_id_baker_profiles_user_id_fk" FOREIGN KEY ("baker_id") REFERENCES "public"."baker_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_baker_id_baker_profiles_user_id_fk" FOREIGN KEY ("baker_id") REFERENCES "public"."baker_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "baker_profiles_slug_idx" ON "baker_profiles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "claims_eater_idx" ON "claims" USING btree ("eater_id");--> statement-breakpoint
CREATE INDEX "claims_listing_idx" ON "claims" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "claims_status_idx" ON "claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX "listing_tags_tag_idx" ON "listing_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "listings_status_idx" ON "listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "listings_ready_at_idx" ON "listings" USING btree ("ready_at");--> statement-breakpoint
CREATE INDEX "listings_baker_idx" ON "listings" USING btree ("baker_id");--> statement-breakpoint
CREATE INDEX "listings_location_idx" ON "listings" USING gist ("location");--> statement-breakpoint
CREATE INDEX "schedules_baker_idx" ON "schedules" USING btree ("baker_id");--> statement-breakpoint
CREATE INDEX "users_location_idx" ON "users" USING gist ("location");--> statement-breakpoint
CREATE INDEX "users_can_bake_idx" ON "users" USING btree ("can_bake");