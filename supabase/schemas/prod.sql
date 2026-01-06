


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

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


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
    "exercises_contributed" integer DEFAULT 0,
    "contributions_accepted" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_profiles_subscription_status_check" CHECK (("subscription_status" = ANY (ARRAY['active'::"text", 'past_due'::"text", 'canceled'::"text", 'trialing'::"text", NULL::"text"]))),
    CONSTRAINT "user_profiles_tier_check" CHECK ((("tier" >= 0) AND ("tier" <= 2)))
);


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

CREATE POLICY "exercises_paid_read" ON "public"."exercises" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."tier" >= 1)))));


CREATE POLICY "profiles_read_own" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "id"));


CREATE POLICY "profiles_update_own" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));

CREATE POLICY "free_tier_read" ON "public"."structure_details"
  FOR SELECT
  USING (true); -- Everyone can select

ALTER TABLE "public"."structure_exercises" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "structure_exercises_paid_read" ON "public"."structure_exercises" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."tier" >= 1)))));



ALTER TABLE "public"."structures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "structures_public_read" ON "public"."structures" FOR SELECT USING (true);


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


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



-- GRANT ALL ON TABLE "public"."structure_clinical" TO "anon";
-- GRANT ALL ON TABLE "public"."structure_clinical" TO "authenticated";
-- GRANT ALL ON TABLE "public"."structure_clinical" TO "service_role";



GRANT ALL ON TABLE "public"."structure_exercises" TO "anon";
GRANT ALL ON TABLE "public"."structure_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."structure_exercises" TO "service_role";



GRANT ALL ON TABLE "public"."structures" TO "anon";
GRANT ALL ON TABLE "public"."structures" TO "authenticated";
GRANT ALL ON TABLE "public"."structures" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";









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































