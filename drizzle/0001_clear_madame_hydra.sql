CREATE TYPE "public"."user_role" AS ENUM('fighter', 'admin', 'manager', 'viewer');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(256) NOT NULL,
	"full_name" varchar(256),
	"avatar_url" text,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"phone_number" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "fighters" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "fighters" ADD CONSTRAINT "fighters_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fighters" ADD CONSTRAINT "fighters_user_id_unique" UNIQUE("user_id");