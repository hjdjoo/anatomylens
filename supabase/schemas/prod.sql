-- AnatomyLens Production Schema
-- Cleaned version with consistent formatting and secure function search paths

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

COMMENT ON SCHEMA public IS 'standard public schema';

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

SET default_tablespace = '';
SET default_table_access_method = heap;

--------------------------------------------------------------------------------
-- TABLES
--------------------------------------------------------------------------------

-- Core anatomy structures
CREATE TABLE IF NOT EXISTS public.structures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mesh_id text NOT NULL,
    original_name text NOT NULL,
    type text NOT NULL,
    region text NOT NULL,
    layer integer NOT NULL,
    side text,
    summary text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.structures OWNER TO postgres;

-- Structure details (free/premium tiers)
CREATE TABLE IF NOT EXISTS public.structure_details (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
    
    -- Free tier data
    summary text,
    actions text[],
    
    -- Premium tier data
    description text,
    attachments jsonb,
    innervation text,
    articulations text,
    
    -- Metadata
    source text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    UNIQUE(structure_id)
);

ALTER TABLE public.structure_details OWNER TO postgres;

-- Exercises
CREATE TABLE IF NOT EXISTS public.exercises (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    difficulty integer NOT NULL,
    equipment text[] DEFAULT '{}',
    category text,
    movement_pattern text,
    video_url text,
    thumbnail_url text,
    instructions text,
    cues text[] DEFAULT '{}',
    common_mistakes text[] DEFAULT '{}',
    contributed_by uuid,
    contributor_name text,
    source_url text,
    status text DEFAULT 'published',
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT exercises_difficulty_check CHECK (difficulty >= 1 AND difficulty <= 5),
    CONSTRAINT exercises_status_check CHECK (status = ANY (ARRAY['draft', 'pending_review', 'published', 'rejected']))
);

ALTER TABLE public.exercises OWNER TO postgres;

-- Structure to exercise mappings
CREATE TABLE IF NOT EXISTS public.structure_exercises (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid NOT NULL,
    exercise_id uuid NOT NULL,
    involvement text NOT NULL,
    notes text,
    contributed_by uuid,
    status text DEFAULT 'published',
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT structure_exercises_involvement_check CHECK (involvement = ANY (ARRAY['primary', 'secondary', 'stabilizer', 'stretched'])),
    CONSTRAINT structure_exercises_status_check CHECK (status = ANY (ARRAY['pending_review', 'published', 'rejected']))
);

ALTER TABLE public.structure_exercises OWNER TO postgres;

-- User profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id uuid NOT NULL,
    display_name text,
    avatar_url text,
    tier integer DEFAULT 0 NOT NULL,
    stripe_customer_id text,
    subscription_id text,
    subscription_status text,
    subscription_ends_at timestamp with time zone,
    subscription_renews_at timestamp with time zone DEFAULT NULL,
    exercises_contributed integer DEFAULT 0,
    contributions_accepted integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    weight_unit text DEFAULT 'lbs',
    CONSTRAINT user_profiles_weight_unit_check CHECK (weight_unit IN ('lbs', 'kg')),
    CONSTRAINT user_profiles_subscription_status_check CHECK (subscription_status = ANY (ARRAY['active', 'past_due', 'canceled', 'trialing', NULL])),
    CONSTRAINT user_profiles_tier_check CHECK (tier >= 0 AND tier <= 2)
);

ALTER TABLE public.user_profiles OWNER TO postgres;

COMMENT ON COLUMN public.user_profiles.weight_unit IS 'User preferred weight unit: lbs or kg';
COMMENT ON COLUMN public.user_profiles.subscription_renews_at IS 'Next renewal date for active subscriptions. NULL if subscription is canceled or user is on free tier.';
COMMENT ON COLUMN public.user_profiles.subscription_ends_at IS 'When premium access ends. Set when user cancels (access continues until this date). NULL for active/renewing subscriptions.';

-- User saved exercises
CREATE TABLE IF NOT EXISTS public.user_exercises (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
    notes text,
    sets integer,
    reps integer,
    weight numeric,
    rest_seconds integer,
    folder_id uuid,
    sort_order integer DEFAULT 0,
    added_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, exercise_id)
);

ALTER TABLE public.user_exercises OWNER TO postgres;

-- Exercise suggestions (community)
CREATE TABLE IF NOT EXISTS public.exercise_suggestions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    difficulty integer NOT NULL,
    equipment text[] DEFAULT '{}',
    video_url text,
    suggested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contributor_name text,
    status text NOT NULL DEFAULT 'pending',
    rejection_reason text,
    upvotes integer NOT NULL DEFAULT 0,
    downvotes integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    promoted_at timestamp with time zone,
    promoted_exercise_id uuid REFERENCES public.exercises(id),
    CONSTRAINT exercise_suggestions_difficulty_check CHECK (difficulty >= 1 AND difficulty <= 5),
    CONSTRAINT exercise_suggestions_status_check CHECK (status IN ('pending', 'rejected', 'promoted'))
);

COMMENT ON TABLE public.exercise_suggestions IS 'User-submitted exercise suggestions for community review';

-- Suggestion structure mappings
CREATE TABLE IF NOT EXISTS public.suggestion_structures (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_id uuid NOT NULL REFERENCES public.exercise_suggestions(id) ON DELETE CASCADE,
    structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
    involvement text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT suggestion_structures_involvement_check CHECK (involvement IN ('primary', 'secondary', 'stabilizer', 'stretched')),
    UNIQUE (suggestion_id, structure_id)
);

COMMENT ON TABLE public.suggestion_structures IS 'Muscle/structure mappings for exercise suggestions';

-- Suggestion votes
CREATE TABLE IF NOT EXISTS public.suggestion_votes (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    suggestion_id uuid NOT NULL REFERENCES public.exercise_suggestions(id) ON DELETE CASCADE,
    vote integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT suggestion_votes_vote_check CHECK (vote IN (-1, 1)),
    PRIMARY KEY (user_id, suggestion_id)
);

COMMENT ON TABLE public.suggestion_votes IS 'User votes on exercise suggestions';

--------------------------------------------------------------------------------
-- PRIMARY KEYS & UNIQUE CONSTRAINTS
--------------------------------------------------------------------------------

ALTER TABLE ONLY public.structures
    ADD CONSTRAINT structures_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.structures
    ADD CONSTRAINT structures_mesh_id_key UNIQUE (mesh_id);

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.structure_exercises
    ADD CONSTRAINT structure_exercises_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.structure_exercises
    ADD CONSTRAINT structure_exercises_structure_id_exercise_id_key UNIQUE (structure_id, exercise_id);

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_stripe_customer_id_key UNIQUE (stripe_customer_id);

--------------------------------------------------------------------------------
-- INDEXES
--------------------------------------------------------------------------------

-- Structures
CREATE INDEX idx_structures_mesh_id ON public.structures USING btree (mesh_id);
CREATE INDEX idx_structures_region ON public.structures USING btree (region);
CREATE INDEX idx_structures_type ON public.structures USING btree (type);

-- Structure details
CREATE INDEX idx_structure_details_structure_id ON public.structure_details USING btree (structure_id);

-- Exercises
CREATE INDEX idx_exercises_difficulty ON public.exercises USING btree (difficulty);
CREATE INDEX idx_exercises_slug ON public.exercises USING btree (slug);
CREATE INDEX idx_exercises_status ON public.exercises USING btree (status);

-- Structure exercises
CREATE INDEX idx_structure_exercises_exercise ON public.structure_exercises USING btree (exercise_id);
CREATE INDEX idx_structure_exercises_structure ON public.structure_exercises USING btree (structure_id);

-- User exercises
CREATE INDEX idx_user_exercises_user_id ON public.user_exercises (user_id);
CREATE INDEX idx_user_exercises_exercise_id ON public.user_exercises (exercise_id);
CREATE INDEX idx_user_exercises_added_at ON public.user_exercises (user_id, added_at DESC);

-- Exercise suggestions
CREATE INDEX idx_suggestion_structures_structure ON public.suggestion_structures USING btree (structure_id);
CREATE INDEX idx_suggestions_status_votes ON public.exercise_suggestions (status, upvotes DESC, downvotes);
CREATE INDEX idx_suggestions_user_created ON public.exercise_suggestions (suggested_by, created_at DESC);
CREATE INDEX idx_votes_user ON public.suggestion_votes USING btree (user_id);

--------------------------------------------------------------------------------
-- FOREIGN KEYS
--------------------------------------------------------------------------------

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_contributed_by_fkey FOREIGN KEY (contributed_by) REFERENCES auth.users(id);

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);

ALTER TABLE ONLY public.structure_exercises
    ADD CONSTRAINT structure_exercises_contributed_by_fkey FOREIGN KEY (contributed_by) REFERENCES auth.users(id);

ALTER TABLE ONLY public.structure_exercises
    ADD CONSTRAINT structure_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.structure_exercises
    ADD CONSTRAINT structure_exercises_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

--------------------------------------------------------------------------------
-- FUNCTIONS (with secure search_path)
--------------------------------------------------------------------------------

-- Auto-update user_exercises.updated_at
CREATE OR REPLACE FUNCTION public.update_user_exercises_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Update vote counts on suggestion_votes changes
CREATE OR REPLACE FUNCTION public.update_suggestion_vote_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.exercise_suggestions
        SET 
            upvotes = upvotes + CASE WHEN NEW.vote = 1 THEN 1 ELSE 0 END,
            downvotes = downvotes + CASE WHEN NEW.vote = -1 THEN 1 ELSE 0 END,
            updated_at = now()
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
            updated_at = now()
        WHERE id = NEW.suggestion_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.exercise_suggestions
        SET 
            upvotes = upvotes - CASE WHEN OLD.vote = 1 THEN 1 ELSE 0 END,
            downvotes = downvotes - CASE WHEN OLD.vote = -1 THEN 1 ELSE 0 END,
            updated_at = now()
        WHERE id = OLD.suggestion_id;
        RETURN OLD;
    END IF;
END;
$$;

-- Check suggestion rate limit (5 per 24 hours)
CREATE OR REPLACE FUNCTION public.check_suggestion_rate_limit(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    recent_count integer;
BEGIN
    SELECT COUNT(*) INTO recent_count
    FROM public.exercise_suggestions
    WHERE suggested_by = p_user_id
      AND created_at > now() - INTERVAL '24 hours';
    
    RETURN recent_count < 5;
END;
$$;

COMMENT ON FUNCTION public.check_suggestion_rate_limit IS 'Check if user can submit more suggestions (5 per 24h limit)';

-- Get paginated suggestions for a structure with vote info
CREATE OR REPLACE FUNCTION public.get_structure_suggestions(
    p_structure_id uuid,
    p_user_id uuid,
    p_limit integer DEFAULT 10,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    name text,
    description text,
    difficulty integer,
    equipment text[],
    video_url text,
    contributor_name text,
    suggested_by uuid,
    upvotes integer,
    downvotes integer,
    vote_ratio float,
    user_vote integer,
    involvement text,
    created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
            ELSE 0.5
        END AS vote_ratio,
        sv.vote AS user_vote,
        ss.involvement,
        es.created_at
    FROM public.exercise_suggestions es
    JOIN public.suggestion_structures ss ON ss.suggestion_id = es.id
    LEFT JOIN public.suggestion_votes sv ON sv.suggestion_id = es.id AND sv.user_id = p_user_id
    WHERE ss.structure_id = p_structure_id
      AND es.status = 'pending'
    ORDER BY 
        CASE 
            WHEN (es.upvotes + es.downvotes) > 0 
            THEN es.upvotes::float / (es.upvotes + es.downvotes) 
            ELSE 0.5 
        END DESC,
        es.upvotes DESC,
        es.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION public.get_structure_suggestions IS 'Get paginated suggestions for a structure with vote info';

-- Handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, display_name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--------------------------------------------------------------------------------
-- TRIGGERS
--------------------------------------------------------------------------------

CREATE TRIGGER user_exercises_updated_at
    BEFORE UPDATE ON public.user_exercises
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_exercises_updated_at();

DROP TRIGGER IF EXISTS trigger_update_vote_counts ON public.suggestion_votes;
CREATE TRIGGER trigger_update_vote_counts
    AFTER INSERT OR UPDATE OR DELETE ON public.suggestion_votes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_suggestion_vote_counts();

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

--------------------------------------------------------------------------------
-- ROW LEVEL SECURITY
--------------------------------------------------------------------------------

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structure_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structure_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestion_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestion_votes ENABLE ROW LEVEL SECURITY;

-- Structures: public read
CREATE POLICY structures_public_read ON public.structures
    FOR SELECT USING (true);

-- Structure details: public read (tier filtering in app)
CREATE POLICY structure_details_public_read ON public.structure_details
    FOR SELECT USING (true);

-- Exercises: premium users only
CREATE POLICY exercises_paid_read ON public.exercises
    FOR SELECT TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = (SELECT auth.uid())
              AND user_profiles.tier >= 1
        )
    );

-- Structure exercises: premium users only
CREATE POLICY structure_exercises_paid_read ON public.structure_exercises
    FOR SELECT TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = (SELECT auth.uid())
              AND user_profiles.tier >= 1
        )
    );

-- User profiles: own only
CREATE POLICY profiles_read_own ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY profiles_update_own ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- User exercises: own only with tier check for insert
CREATE POLICY user_exercises_select_own ON public.user_exercises
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_exercises_insert_own ON public.user_exercises
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND tier >= 1
        )
    );

CREATE POLICY user_exercises_update_own ON public.user_exercises
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY user_exercises_delete_own ON public.user_exercises
    FOR DELETE USING (auth.uid() = user_id);

-- Exercise suggestions policies
CREATE POLICY suggestions_premium_view ON public.exercise_suggestions
    FOR SELECT
    USING (
        status = 'pending' 
        AND EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = (SELECT auth.uid()) AND tier >= 1
        )
    );

CREATE POLICY suggestions_view_own ON public.exercise_suggestions
    FOR SELECT USING (suggested_by = (SELECT auth.uid()));

CREATE POLICY suggestions_premium_insert ON public.exercise_suggestions
    FOR INSERT
    WITH CHECK (
        suggested_by = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = (SELECT auth.uid()) AND tier >= 1
        )
    );

CREATE POLICY suggestions_update_own_pending ON public.exercise_suggestions
    FOR UPDATE
    USING (suggested_by = (SELECT auth.uid()) AND status = 'pending')
    WITH CHECK (suggested_by = (SELECT auth.uid()) AND status = 'pending');

CREATE POLICY suggestions_delete_own_pending ON public.exercise_suggestions
    FOR DELETE USING (suggested_by = (SELECT auth.uid()) AND status = 'pending');

-- Suggestion structures policies
CREATE POLICY suggestion_structures_view ON public.suggestion_structures
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.exercise_suggestions es
            WHERE es.id = suggestion_id
            AND (
                (es.status = 'pending' AND EXISTS (
                    SELECT 1 FROM public.user_profiles WHERE id = (SELECT auth.uid()) AND tier >= 1
                ))
                OR es.suggested_by = (SELECT auth.uid())
            )
        )
    );

CREATE POLICY suggestion_structures_insert_own ON public.suggestion_structures
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.exercise_suggestions es
            WHERE es.id = suggestion_id AND es.suggested_by = (SELECT auth.uid())
        )
    );

CREATE POLICY suggestion_structures_delete_own ON public.suggestion_structures
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.exercise_suggestions es
            WHERE es.id = suggestion_id AND es.suggested_by = (SELECT auth.uid())
        )
    );

-- Suggestion votes policies
CREATE POLICY votes_premium_view ON public.suggestion_votes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = (SELECT auth.uid()) AND tier >= 1
        )
    );

CREATE POLICY votes_premium_insert ON public.suggestion_votes
    FOR INSERT
    WITH CHECK (
        user_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = (SELECT auth.uid()) AND tier >= 1
        )
    );

CREATE POLICY votes_update_own ON public.suggestion_votes
    FOR UPDATE
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY votes_delete_own ON public.suggestion_votes
    FOR DELETE USING (user_id = (SELECT auth.uid()));

--------------------------------------------------------------------------------
-- GRANTS
--------------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;

GRANT ALL ON TABLE public.exercises TO anon;
GRANT ALL ON TABLE public.exercises TO authenticated;
GRANT ALL ON TABLE public.exercises TO service_role;

GRANT ALL ON TABLE public.structure_exercises TO anon;
GRANT ALL ON TABLE public.structure_exercises TO authenticated;
GRANT ALL ON TABLE public.structure_exercises TO service_role;

GRANT ALL ON TABLE public.structures TO anon;
GRANT ALL ON TABLE public.structures TO authenticated;
GRANT ALL ON TABLE public.structures TO service_role;

GRANT ALL ON TABLE public.user_profiles TO anon;
GRANT ALL ON TABLE public.user_profiles TO authenticated;
GRANT ALL ON TABLE public.user_profiles TO service_role;

GRANT ALL ON TABLE public.user_exercises TO anon;
GRANT ALL ON TABLE public.user_exercises TO authenticated;
GRANT ALL ON TABLE public.user_exercises TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;

--------------------------------------------------------------------------------
-- REALTIME
--------------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime OWNER TO postgres;