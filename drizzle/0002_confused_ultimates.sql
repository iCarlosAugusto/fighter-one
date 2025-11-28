CREATE TYPE "public"."establishment_type" AS ENUM('gym', 'school', 'academy', 'federation', 'promotion', 'club', 'other');--> statement-breakpoint
CREATE TABLE "establishment_admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"establishment_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(50) DEFAULT 'admin' NOT NULL,
	"can_create_championships" boolean DEFAULT true NOT NULL,
	"can_manage_fighters" boolean DEFAULT true NOT NULL,
	"can_schedule_fights" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "establishments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"short_name" varchar(100),
	"type" "establishment_type" NOT NULL,
	"description" text,
	"email" varchar(256),
	"phone" varchar(50),
	"website" text,
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"country" varchar(100) NOT NULL,
	"zip_code" varchar(20),
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"logo_url" text,
	"banner_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"founded_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "championships" ADD COLUMN "establishment_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "championships" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "fighters" ADD COLUMN "establishment_id" integer;--> statement-breakpoint
ALTER TABLE "establishment_admins" ADD CONSTRAINT "establishment_admins_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "establishment_admins" ADD CONSTRAINT "establishment_admins_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championships" ADD CONSTRAINT "championships_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championships" ADD CONSTRAINT "championships_created_by_user_id_profiles_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fighters" ADD CONSTRAINT "fighters_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE set null ON UPDATE no action;