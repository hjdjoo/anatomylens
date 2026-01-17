


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";



CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";



CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";




CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";



SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "difficulty" integer NOT NULL,
    "equipment" "text"[] DEFAULT '{}'::"text"[],
    "category" "text",
    "movement_pattern" "text",
    "video_url" "text",
    "thumbnail_url" "text",
    "instructions" "text",
    "cues" "text"[] DEFAULT '{}'::"text"[],
    "common_mistakes" "text"[] DEFAULT '{}'::"text"[],
    "contributed_by" "uuid",
    "contributor_name" "text",
    "source_url" "text",
    "status" "text" DEFAULT 'published'::"text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "exercises_difficulty_check" CHECK ((("difficulty" >= 1) AND ("difficulty" <= 5))),
    CONSTRAINT "exercises_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending_review'::"text", 'published'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."exercises" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."structure_exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "structure_id" "uuid" NOT NULL,
    "exercise_id" "uuid" NOT NULL,
    "involvement" "text" NOT NULL,
    "notes" "text",
    "contributed_by" "uuid",
    "status" "text" DEFAULT 'published'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "structure_exercises_involvement_check" CHECK (("involvement" = ANY (ARRAY['primary'::"text", 'secondary'::"text", 'stabilizer'::"text", 'stretched'::"text"]))),
    CONSTRAINT "structure_exercises_status_check" CHECK (("status" = ANY (ARRAY['pending_review'::"text", 'published'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."structure_exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."structures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mesh_id" "text" NOT NULL,
    "original_name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "region" "text" NOT NULL,
    "layer" integer NOT NULL,
    "side" "text",
    "summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."structures" OWNER TO "postgres";



ALTER TABLE ONLY "public"."structures"
    ADD CONSTRAINT "structures_mesh_id_key" UNIQUE ("mesh_id");


ALTER TABLE ONLY "public"."structures"
    ADD CONSTRAINT "structures_pkey" PRIMARY KEY ("id");



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "tier" integer DEFAULT 0 NOT NULL,
    "stripe_customer_id" "text",
    "subscription_id" "text",
    "subscription_status" "text",
    "subscription_ends_at" timestamp with time zone,
    "subscription_renews_at" timestamp with time zone DEFAULT null,
    "exercises_contributed" integer DEFAULT 0,
    "contributions_accepted" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "weight_unit" text DEFAULT 'lbs' check (weight_unit in ('lbs', 'kg'))
    CONSTRAINT "user_profiles_subscription_status_check" CHECK (("subscription_status" = ANY (ARRAY['active'::"text", 'past_due'::"text", 'canceled'::"text", 'trialing'::"text", NULL::"text"]))),
    CONSTRAINT "user_profiles_tier_check" CHECK ((("tier" >= 0) AND ("tier" <= 2)))
);

COMMENT ON COLUMN public.user_profiles.weight_unit IS 'User preferred weight unit: lbs or kg';

-- Add comment for documentation
COMMENT ON COLUMN public.user_profiles.subscription_renews_at IS 
  'Next renewal date for active subscriptions. NULL if subscription is canceled or user is on free tier.';

-- Update subscription_ends_at comment for clarity
COMMENT ON COLUMN public.user_profiles.subscription_ends_at IS 
  'When premium access ends. Set when user cancels (access continues until this date). NULL for active/renewing subscriptions.';


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";

ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_slug_key" UNIQUE ("slug");



CREATE TABLE IF NOT EXISTS "public"."structure_details" (
  "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"() NOT NULL,
  "structure_id" "uuid" NOT NULL REFERENCES "public"."structures"(id) ON DELETE CASCADE,
  
  -- Free tier data
  "summary" "text",                    -- Short description (1-2 sentences)
  "actions" "text"[],                  -- Muscle actions (e.g., ['flexes elbow', 'supinates forearm'])
  
  -- Premium tier data  
  "description" "text",                -- Full clinical description
  "attachments" "jsonb",               -- {origin: "...", insertion: "..."} for muscles
  "innervation" "text",                -- Nerve supply
  "articulations" "text",              -- Bone articulations (for bones only)
  
  -- Metadata
  "source" "text"[],                     -- Attribution (e.g., "Z-Anatomy", "Wikipedia")
  "created_at" TIMESTAMPTZ DEFAULT "now"(),
  "updated_at" TIMESTAMPTZ DEFAULT "now"(),
  
  UNIQUE(structure_id)
);

ALTER TABLE ONLY "public"."structure_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_exercises" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "exercise_id" UUID NOT NULL REFERENCES "public"."exercises"("id") ON DELETE CASCADE,
  
  -- Optional fields for future extension (workout planning)
  "notes" TEXT,
  "sets" INTEGER,
  "reps" INTEGER,
  "weight" NUMERIC,                    -- For tracking progression
  "rest_seconds" INTEGER,              -- Rest between sets
  
  -- Organization (for future custom folders feature)
  "folder_id" UUID,                    -- Future: references user_exercise_folders
  "sort_order" INTEGER DEFAULT 0,      -- For custom ordering within folders
  
  -- Metadata
  "added_at" TIMESTAMPTZ DEFAULT now(),
  "updated_at" TIMESTAMPTZ DEFAULT now(),
  
  -- Prevent duplicate saves
  UNIQUE("user_id", "exercise_id")
);

ALTER TABLE "public"."user_exercises" OWNER To "postgres";

CREATE TABLE IF NOT EXISTS "public"."exercise_suggestions" (
  "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
  "name" "text" NOT NULL,
  "description" "text",
  "difficulty" INTEGER NOT NULL CHECK ("difficulty" >= 1 AND "difficulty" <= 5),
  "equipment" "text"[] DEFAULT '{}',
  "video_url" "text",
  
  -- Contributor info
  "suggested_by" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "contributor_name" "text", -- Denormalized for display
  
  -- Status tracking
  "status" "text" NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rejected', 'promoted')),
  "rejection_reason" "text",
  
  -- Vote counts (denormalized for query performance)
  "upvotes" INTEGER NOT NULL DEFAULT 0,
  "downvotes" INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ DEFAULT NOW(),
  
  -- If promoted, link to the created exercise
  "promoted_at" TIMESTAMPTZ,
  "promoted_exercise_id" "uuid" REFERENCES "public"."exercises"("id")
);

-- Structure mappings for suggestions (which muscles does this exercise work?)
CREATE TABLE IF NOT EXISTS "public"."suggestion_structures" (
  "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
  "suggestion_id" "uuid" NOT NULL REFERENCES "public"."exercise_suggestions"("id") ON DELETE CASCADE,
  "structure_id" "uuid" NOT NULL REFERENCES "public"."structures"("id") ON DELETE CASCADE,
  "involvement" "text" NOT NULL CHECK ("involvement" IN ('primary', 'secondary', 'stabilizer', 'stretched')),
  "notes" "text",
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  
  -- One mapping per structure per suggestion
  UNIQUE ("suggestion_id", "structure_id")
);

-- User votes on suggestions
CREATE TABLE IF NOT EXISTS "public"."suggestion_votes" (
  "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "suggestion_id" "uuid" NOT NULL REFERENCES "public"."exercise_suggestions"("id") ON DELETE CASCADE,
  "vote" INTEGER NOT NULL CHECK ("vote" IN (-1, 1)), -- -1 = downvote, 1 = upvote
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ DEFAULT NOW()
);




ALTER TABLE ONLY "public"."structure_exercises"
    ADD CONSTRAINT "structure_exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."structure_exercises"
    ADD CONSTRAINT "structure_exercises_structure_id_exercise_id_key" UNIQUE ("structure_id", "exercise_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



CREATE INDEX "idx_exercises_difficulty" ON "public"."exercises" USING "btree" ("difficulty");



CREATE INDEX "idx_exercises_slug" ON "public"."exercises" USING "btree" ("slug");



CREATE INDEX "idx_exercises_status" ON "public"."exercises" USING "btree" ("status");



CREATE INDEX "idx_structure_exercises_exercise" ON "public"."structure_exercises" USING "btree" ("exercise_id");



CREATE INDEX "idx_structure_exercises_structure" ON "public"."structure_exercises" USING "btree" ("structure_id");



CREATE INDEX "idx_structures_mesh_id" ON "public"."structures" USING "btree" ("mesh_id");



CREATE INDEX "idx_structures_region" ON "public"."structures" USING "btree" ("region");



CREATE INDEX "idx_structures_type" ON "public"."structures" USING "btree" ("type");

CREATE INDEX idx_structure_details_structure_id ON "public"."structure_details" USING "btree"("structure_id");

CREATE INDEX idx_user_exercises_user_id ON "public"."user_exercises"("user_id");
CREATE INDEX idx_user_exercises_exercise_id ON "public"."user_exercises"("exercise_id");
CREATE INDEX idx_user_exercises_added_at ON "public"."user_exercises"("user_id", "added_at" DESC);

-- For fetching suggestions for a specific structure
CREATE INDEX "idx_suggestion_structures_structure" 
  ON "public"."suggestion_structures" using "btree" ("structure_id");

-- For fetching suggestions by status and sorting by score
CREATE INDEX "idx_suggestions_status_votes" 
  ON "public"."exercise_suggestions"("status", "upvotes" DESC, "downvotes");

-- For rate limiting checks
CREATE INDEX "idx_suggestions_user_created" 
  ON "public"."exercise_suggestions"("suggested_by", "created_at" DESC);

-- For user's vote lookup
CREATE INDEX "idx_votes_user" 
  ON "public"."suggestion_votes" using "btree" ("user_id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_contributed_by_fkey" FOREIGN KEY ("contributed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");


ALTER TABLE ONLY "public"."structure_exercises"
    ADD CONSTRAINT "structure_exercises_contributed_by_fkey" FOREIGN KEY ("contributed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."structure_exercises"
    ADD CONSTRAINT "structure_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."structure_exercises"
    ADD CONSTRAINT "structure_exercises_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "public"."structures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


ALTER TABLE "public"."exercises" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."structure_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercise_suggestions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."suggestion_structures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."suggestion_votes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercises_paid_read" ON "public"."exercises" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = auth.uid()) AND ("user_profiles"."tier" >= 1)))));


CREATE POLICY "profiles_read_own" ON "public"."user_profiles" FOR SELECT USING ((auth.uid() = "id"));


CREATE POLICY "profiles_update_own" ON "public"."user_profiles" FOR UPDATE USING ((auth.uid() = "id"));

CREATE POLICY "free_tier_read" ON "public"."structure_details"
  FOR SELECT
  USING (true); -- Everyone can select

ALTER TABLE "public"."structure_exercises" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "structure_exercises_paid_read" ON "public"."structure_exercises" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = auth.uid()) AND ("user_profiles"."tier" >= 1)))));



ALTER TABLE "public"."structures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "structures_public_read" ON "public"."structures" FOR SELECT USING (true);


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_exercises" ENABLE ROW LEVEL SECURITY;

-- Users can only read their own saved exercises
CREATE POLICY "user_exercises_select_own" ON "public"."user_exercises"
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own exercises (must have tier 1+)
CREATE POLICY "user_exercises_insert_own" ON "public"."user_exercises"
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND tier >= 1
    )
  );

-- Users can only update their own exercises
CREATE POLICY "user_exercises_update_own" ON "public"."user_exercises"
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete their own exercises
CREATE POLICY "user_exercises_delete_own" ON "public"."user_exercises"
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Premium users can view pending suggestions"
  ON "public"."exercise_suggestions"
  FOR SELECT
  USING (
    status = 'pending' 
    AND EXISTS (
      SELECT 1 FROM "public"."user_profiles" 
      WHERE "id" = (SELECT auth.uid()) AND tier >= 1
    )
  );

-- Suggestions: Users can view their own suggestions regardless of status
CREATE POLICY "Users can view own suggestions"
  ON "public"."exercise_suggestions"
  FOR SELECT
  USING ("suggested_by" = (SELECT auth.uid()));

-- Suggestions: Premium users can insert (rate limit enforced at app level)
CREATE POLICY "Premium users can suggest exercises"
  ON "public"."exercise_suggestions"
  FOR INSERT
  WITH CHECK (
    "suggested_by" = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM "public"."user_profiles" 
      WHERE "id" = (SELECT auth.uid()) AND "tier" >= 1
    )
  );

-- Suggestions: Users can update their own pending suggestions
CREATE POLICY "Users can update own pending suggestions"
  ON "public"."exercise_suggestions"
  FOR UPDATE
  USING ("suggested_by" = (SELECT auth.uid()) AND status = 'pending')
  WITH CHECK ("suggested_by" = (SELECT auth.uid()) AND status = 'pending');

-- Suggestions: Users can delete their own pending suggestions
CREATE POLICY "Users can delete own pending suggestions"
  ON "public"."exercise_suggestions"
  FOR DELETE
  USING ("suggested_by" = (SELECT auth.uid()) AND status = 'pending');

-- Suggestion structures: Viewable if parent suggestion is viewable
CREATE POLICY "View suggestion structures"
  ON "public"."suggestion_structures"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."exercise_suggestions" "es"
      WHERE "es"."id" = "suggestion_id"
      AND (
        "es".status = 'pending' AND EXISTS (
          SELECT 1 FROM "public"."user_profiles" WHERE "id" = (SELECT auth.uid()) AND tier >= 1
        )
        OR "es"."suggested_by" = (SELECT auth.uid())
      )
    )
  );

-- Suggestion structures: Insert if user owns the suggestion
CREATE POLICY "Insert suggestion structures for own suggestions"
  ON "public"."suggestion_structures"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."exercise_suggestions" "es"
      WHERE "es"."id" = "suggestion_id" AND "es"."suggested_by" = (SELECT auth.uid())
    )
  );

-- Suggestion structures: Delete if user owns the suggestion
CREATE POLICY "Delete suggestion structures for own suggestions"
  ON "public"."suggestion_structures"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "public"."exercise_suggestions" "es"
      WHERE "es"."id" = "suggestion_id" AND "es"."suggested_by" = (SELECT auth.uid())
    )
  );

-- Votes: Premium users can view all votes
CREATE POLICY "Premium users can view votes"
  ON "public"."suggestion_votes"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."user_profiles" 
      WHERE "id" = (SELECT auth.uid()) AND "tier" >= 1
    )
  );

-- Votes: Premium users can insert/update their vote
CREATE POLICY "Premium users can vote"
  ON "public"."suggestion_votes"
  FOR INSERT
  WITH CHECK (
    "user_id" = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM "public"."user_profiles" 
      WHERE "id" = (SELECT auth.uid()) AND "tier" >= 1
    )
  );

-- Votes: Users can update their own vote
CREATE POLICY "Users can update own vote"
  ON "public"."suggestion_votes"
  FOR UPDATE
  USING ("user_id" = (SELECT auth.uid()))
  WITH CHECK ("user_id" = (SELECT auth.uid()));

-- Votes: Users can delete their own vote
CREATE POLICY "Users can delete own vote"
  ON "public"."suggestion_votes"
  FOR DELETE
  USING ("user_id" = (SELECT auth.uid()));


  drop policy "exercises_paid_read" on "public"."exercises";

  create policy "exercises_paid_read"
  on "public"."exercises"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = ( SELECT auth.uid())) AND (user_profiles.tier >= 1)))));


  drop policy "structure_exercises_paid_read" on "public"."structure_exercises";

  create policy "structure_exercises_paid_read"
  on "public"."structure_exercises"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = ( SELECT auth.uid())) AND (user_profiles.tier >= 1)))));



ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public".update_user_exercises_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_exercises_updated_at
  BEFORE UPDATE ON "public"."user_exercises"
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_exercises_updated_at();


CREATE OR REPLACE FUNCTION public.update_suggestion_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.exercise_suggestions
    SET 
      upvotes = upvotes + CASE WHEN NEW.vote = 1 THEN 1 ELSE 0 END,
      downvotes = downvotes + CASE WHEN NEW.vote = -1 THEN 1 ELSE 0 END,
      updated_at = NOW()
    WHERE id = NEW.suggestion_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.exercise_suggestions
    SET 
      upvotes = upvotes 
        - CASE WHEN OLD.vote = 1 THEN 1 ELSE 0 END
        + CASE WHEN NEW.vote = 1 THEN 1 ELSE 0 END,
      downvotes = downvotes 
        - CASE WHEN OLD.vote = -1 THEN 1 ELSE 0 END
        + CASE WHEN NEW.vote = -1 THEN 1 ELSE 0 END,
      updated_at = NOW()
    WHERE id = NEW.suggestion_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.exercise_suggestions
    SET 
      upvotes = upvotes - CASE WHEN OLD.vote = 1 THEN 1 ELSE 0 END,
      downvotes = downvotes - CASE WHEN OLD.vote = -1 THEN 1 ELSE 0 END,
      updated_at = NOW()
    WHERE id = OLD.suggestion_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Trigger for vote count updates
DROP TRIGGER IF EXISTS trigger_update_vote_counts ON public.suggestion_votes;
CREATE TRIGGER trigger_update_vote_counts
  AFTER INSERT OR UPDATE OR DELETE ON public.suggestion_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_suggestion_vote_counts();

-- Function to check rate limit (5 suggestions per 24 hours)
CREATE OR REPLACE FUNCTION public.check_suggestion_rate_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.exercise_suggestions
  WHERE suggested_by = p_user_id
    AND created_at > NOW() - INTERVAL '24 hours';
  
  RETURN recent_count < 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get suggestions for a structure with vote info
CREATE OR REPLACE FUNCTION public.get_structure_suggestions(
  p_structure_id UUID,
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  difficulty INTEGER,
  equipment TEXT[],
  video_url TEXT,
  contributor_name TEXT,
  suggested_by UUID,
  upvotes INTEGER,
  downvotes INTEGER,
  vote_ratio FLOAT,
  user_vote INTEGER,
  involvement TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    es.id,
    es.name,
    es.description,
    es.difficulty,
    es.equipment,
    es.video_url,
    es.contributor_name,
    es.suggested_by,
    es.upvotes,
    es.downvotes,
    CASE 
      WHEN (es.upvotes + es.downvotes) > 0 
      THEN es.upvotes::float / (es.upvotes + es.downvotes) 
      ELSE 0.5 -- Neutral ratio for unvoted suggestions
    END as vote_ratio,
    sv.vote as user_vote,
    ss.involvement,
    es.created_at
  FROM public.exercise_suggestions es
  JOIN public.suggestion_structures ss ON ss.suggestion_id = es.id
  LEFT JOIN public.suggestion_votes sv ON sv.suggestion_id = es.id AND sv.user_id = p_user_id
  WHERE ss.structure_id = p_structure_id
    AND es.status = 'pending'
  ORDER BY 
    -- Sort by ratio first (higher is better)
    CASE 
      WHEN (es.upvotes + es.downvotes) > 0 
      THEN es.upvotes::float / (es.upvotes + es.downvotes) 
      ELSE 0.5 
    END DESC,
    -- Then by raw upvotes
    es.upvotes DESC,
    -- Then by recency
    es.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  -- perform set_config('search_path', 'public,pg_temp', true);
  insert into public.user_profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;

  return new;
end;
$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


COMMENT ON TABLE public.exercise_suggestions IS 'User-submitted exercise suggestions for community review';
COMMENT ON TABLE public.suggestion_structures IS 'Muscle/structure mappings for exercise suggestions';
COMMENT ON TABLE public.suggestion_votes IS 'User votes on exercise suggestions';
COMMENT ON FUNCTION public.check_suggestion_rate_limit IS 'Check if user can submit more suggestions (5 per 24h limit)';
COMMENT ON FUNCTION public.get_structure_suggestions IS 'Get paginated suggestions for a structure with vote info';


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON TABLE "public"."exercises" TO "anon";
GRANT ALL ON TABLE "public"."exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."exercises" TO "service_role";



GRANT ALL ON TABLE "public"."structure_exercises" TO "anon";
GRANT ALL ON TABLE "public"."structure_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."structure_exercises" TO "service_role";



GRANT ALL ON TABLE "public"."structures" TO "anon";
GRANT ALL ON TABLE "public"."structures" TO "authenticated";
GRANT ALL ON TABLE "public"."structures" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";


GRANT ALL ON TABLE "public"."user_exercises" TO "anon";
GRANT ALL ON TABLE "public"."user_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."user_exercises" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";




ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";










