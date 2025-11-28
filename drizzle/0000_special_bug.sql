CREATE TYPE "public"."championship_status" AS ENUM('draft', 'registration_open', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."championship_type" AS ENUM('single_elimination', 'double_elimination', 'round_robin');--> statement-breakpoint
CREATE TYPE "public"."fight_result" AS ENUM('ko', 'tko', 'submission', 'decision', 'draw', 'no_contest', 'disqualification');--> statement-breakpoint
CREATE TYPE "public"."fight_status" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TABLE "championship_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"championship_id" integer NOT NULL,
	"fight_id" integer NOT NULL,
	"round" integer NOT NULL,
	"match_number" integer NOT NULL,
	"bracket_type" varchar(50) DEFAULT 'winners',
	"next_match_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "championship_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"championship_id" integer NOT NULL,
	"fighter_id" integer NOT NULL,
	"seed_number" integer,
	"is_eliminated" boolean DEFAULT false NOT NULL,
	"eliminated_in_round" integer,
	"final_placement" integer,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "championships" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"type" "championship_type" DEFAULT 'single_elimination' NOT NULL,
	"weight_class_id" integer,
	"max_participants" integer NOT NULL,
	"min_participants" integer DEFAULT 2 NOT NULL,
	"registration_start_date" timestamp NOT NULL,
	"registration_end_date" timestamp NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"status" "championship_status" DEFAULT 'draft' NOT NULL,
	"current_round" integer DEFAULT 0 NOT NULL,
	"prize_pool" numeric(10, 2),
	"ranking_points_multiplier" numeric(3, 2) DEFAULT '1.5' NOT NULL,
	"winner_id" integer,
	"runner_up_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fighter_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"fighter_id" integer NOT NULL,
	"total_fights" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"no_contests" integer DEFAULT 0 NOT NULL,
	"wins_ko" integer DEFAULT 0 NOT NULL,
	"wins_tko" integer DEFAULT 0 NOT NULL,
	"wins_submission" integer DEFAULT 0 NOT NULL,
	"wins_decision" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_win_streak" integer DEFAULT 0 NOT NULL,
	"average_fight_duration" integer,
	"finish_rate" numeric(5, 2) DEFAULT '0',
	"ranking_points" numeric(10, 2) DEFAULT '1000' NOT NULL,
	"ranking_position" integer,
	"weight_class_rank" integer,
	"championship_wins" integer DEFAULT 0 NOT NULL,
	"championship_appearances" integer DEFAULT 0 NOT NULL,
	"last_fight_date" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fighter_stats_fighter_id_unique" UNIQUE("fighter_id")
);
--> statement-breakpoint
CREATE TABLE "fighters" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"nickname" varchar(100),
	"email" varchar(256),
	"phone" varchar(50),
	"weight" numeric(5, 2) NOT NULL,
	"height" integer NOT NULL,
	"reach" integer,
	"gender" "gender" NOT NULL,
	"birth_date" timestamp NOT NULL,
	"nationality" varchar(100),
	"country" varchar(100),
	"city" varchar(100),
	"state" varchar(100),
	"weight_class_id" integer,
	"stance" varchar(50),
	"fighting_style" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_suspended" boolean DEFAULT false NOT NULL,
	"suspended_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fighters_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "fights" (
	"id" serial PRIMARY KEY NOT NULL,
	"fighter1_id" integer NOT NULL,
	"fighter2_id" integer NOT NULL,
	"scheduled_date" timestamp NOT NULL,
	"actual_date" timestamp,
	"location" varchar(256),
	"venue" varchar(256),
	"weight_class_id" integer,
	"scheduled_rounds" integer DEFAULT 3 NOT NULL,
	"round_duration" integer DEFAULT 300 NOT NULL,
	"status" "fight_status" DEFAULT 'scheduled' NOT NULL,
	"winner_id" integer,
	"loser_id" integer,
	"result" "fight_result",
	"result_details" text,
	"ended_in_round" integer,
	"fight_duration" integer,
	"is_main_event" boolean DEFAULT false NOT NULL,
	"is_title_fight" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weight_classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"min_weight" numeric(5, 2) NOT NULL,
	"max_weight" numeric(5, 2) NOT NULL,
	"gender" "gender" NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "championship_matches" ADD CONSTRAINT "championship_matches_championship_id_championships_id_fk" FOREIGN KEY ("championship_id") REFERENCES "public"."championships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championship_matches" ADD CONSTRAINT "championship_matches_fight_id_fights_id_fk" FOREIGN KEY ("fight_id") REFERENCES "public"."fights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championship_matches" ADD CONSTRAINT "championship_matches_next_match_id_championship_matches_id_fk" FOREIGN KEY ("next_match_id") REFERENCES "public"."championship_matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championship_participants" ADD CONSTRAINT "championship_participants_championship_id_championships_id_fk" FOREIGN KEY ("championship_id") REFERENCES "public"."championships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championship_participants" ADD CONSTRAINT "championship_participants_fighter_id_fighters_id_fk" FOREIGN KEY ("fighter_id") REFERENCES "public"."fighters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championships" ADD CONSTRAINT "championships_weight_class_id_weight_classes_id_fk" FOREIGN KEY ("weight_class_id") REFERENCES "public"."weight_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championships" ADD CONSTRAINT "championships_winner_id_fighters_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."fighters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championships" ADD CONSTRAINT "championships_runner_up_id_fighters_id_fk" FOREIGN KEY ("runner_up_id") REFERENCES "public"."fighters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fighter_stats" ADD CONSTRAINT "fighter_stats_fighter_id_fighters_id_fk" FOREIGN KEY ("fighter_id") REFERENCES "public"."fighters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fighters" ADD CONSTRAINT "fighters_weight_class_id_weight_classes_id_fk" FOREIGN KEY ("weight_class_id") REFERENCES "public"."weight_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fights" ADD CONSTRAINT "fights_fighter1_id_fighters_id_fk" FOREIGN KEY ("fighter1_id") REFERENCES "public"."fighters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fights" ADD CONSTRAINT "fights_fighter2_id_fighters_id_fk" FOREIGN KEY ("fighter2_id") REFERENCES "public"."fighters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fights" ADD CONSTRAINT "fights_weight_class_id_weight_classes_id_fk" FOREIGN KEY ("weight_class_id") REFERENCES "public"."weight_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fights" ADD CONSTRAINT "fights_winner_id_fighters_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."fighters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fights" ADD CONSTRAINT "fights_loser_id_fighters_id_fk" FOREIGN KEY ("loser_id") REFERENCES "public"."fighters"("id") ON DELETE no action ON UPDATE no action;