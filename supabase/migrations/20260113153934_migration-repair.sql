
  create table "public"."exercise_suggestions" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "difficulty" integer not null,
    "equipment" text[] default '{}'::text[],
    "video_url" text,
    "suggested_by" uuid not null,
    "contributor_name" text,
    "status" text not null default 'pending'::text,
    "rejection_reason" text,
    "upvotes" integer not null default 0,
    "downvotes" integer not null default 0,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "promoted_at" timestamp with time zone,
    "promoted_exercise_id" uuid
      );


alter table "public"."exercise_suggestions" enable row level security;


  create table "public"."exercises" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "slug" text not null,
    "description" text,
    "difficulty" integer not null,
    "equipment" text[] default '{}'::text[],
    "category" text,
    "movement_pattern" text,
    "video_url" text,
    "thumbnail_url" text,
    "instructions" text,
    "cues" text[] default '{}'::text[],
    "common_mistakes" text[] default '{}'::text[],
    "contributed_by" uuid,
    "contributor_name" text,
    "source_url" text,
    "status" text default 'published'::text,
    "reviewed_by" uuid,
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."exercises" enable row level security;


  create table "public"."structure_details" (
    "id" uuid not null default gen_random_uuid(),
    "structure_id" uuid not null,
    "summary" text,
    "actions" text[],
    "description" text,
    "attachments" jsonb,
    "innervation" text,
    "articulations" text,
    "source" text[],
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."structure_details" enable row level security;


  create table "public"."structure_exercises" (
    "id" uuid not null default gen_random_uuid(),
    "structure_id" uuid not null,
    "exercise_id" uuid not null,
    "involvement" text not null,
    "notes" text,
    "contributed_by" uuid,
    "status" text default 'published'::text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."structure_exercises" enable row level security;


  create table "public"."structures" (
    "id" uuid not null default gen_random_uuid(),
    "mesh_id" text not null,
    "original_name" text not null,
    "type" text not null,
    "region" text not null,
    "layer" integer not null,
    "side" text,
    "summary" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."structures" enable row level security;


  create table "public"."suggestion_structures" (
    "id" uuid not null default gen_random_uuid(),
    "suggestion_id" uuid not null,
    "structure_id" uuid not null,
    "involvement" text not null,
    "notes" text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."suggestion_structures" enable row level security;


  create table "public"."suggestion_votes" (
    "user_id" uuid not null,
    "suggestion_id" uuid not null,
    "vote" integer not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."suggestion_votes" enable row level security;


  create table "public"."user_exercises" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "exercise_id" uuid not null,
    "notes" text,
    "sets" integer,
    "reps" integer,
    "weight" numeric,
    "rest_seconds" integer,
    "folder_id" uuid,
    "sort_order" integer default 0,
    "added_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."user_exercises" enable row level security;


  create table "public"."user_profiles" (
    "id" uuid not null,
    "display_name" text,
    "avatar_url" text,
    "tier" integer not null default 0,
    "stripe_customer_id" text,
    "subscription_id" text,
    "subscription_status" text,
    "subscription_ends_at" timestamp with time zone,
    "subscription_renews_at" timestamp with time zone,
    "exercises_contributed" integer default 0,
    "contributions_accepted" integer default 0,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "weight_unit" text default 'lbs'::text
      );


alter table "public"."user_profiles" enable row level security;

CREATE UNIQUE INDEX exercise_suggestions_pkey ON public.exercise_suggestions USING btree (id);

CREATE UNIQUE INDEX exercises_pkey ON public.exercises USING btree (id);

CREATE UNIQUE INDEX exercises_slug_key ON public.exercises USING btree (slug);

CREATE INDEX idx_exercises_difficulty ON public.exercises USING btree (difficulty);

CREATE INDEX idx_exercises_slug ON public.exercises USING btree (slug);

CREATE INDEX idx_exercises_status ON public.exercises USING btree (status);

CREATE INDEX idx_structure_details_structure_id ON public.structure_details USING btree (structure_id);

CREATE INDEX idx_structure_exercises_exercise ON public.structure_exercises USING btree (exercise_id);

CREATE INDEX idx_structure_exercises_structure ON public.structure_exercises USING btree (structure_id);

CREATE INDEX idx_structures_mesh_id ON public.structures USING btree (mesh_id);

CREATE INDEX idx_structures_region ON public.structures USING btree (region);

CREATE INDEX idx_structures_type ON public.structures USING btree (type);

CREATE INDEX idx_suggestion_structures_structure ON public.suggestion_structures USING btree (structure_id);

CREATE INDEX idx_suggestions_status_votes ON public.exercise_suggestions USING btree (status, upvotes DESC, downvotes);

CREATE INDEX idx_suggestions_user_created ON public.exercise_suggestions USING btree (suggested_by, created_at DESC);

CREATE INDEX idx_user_exercises_added_at ON public.user_exercises USING btree (user_id, added_at DESC);

CREATE INDEX idx_user_exercises_exercise_id ON public.user_exercises USING btree (exercise_id);

CREATE INDEX idx_user_exercises_user_id ON public.user_exercises USING btree (user_id);

CREATE INDEX idx_votes_user ON public.suggestion_votes USING btree (user_id);

CREATE UNIQUE INDEX structure_details_pkey ON public.structure_details USING btree (id);

CREATE UNIQUE INDEX structure_details_structure_id_key ON public.structure_details USING btree (structure_id);

CREATE UNIQUE INDEX structure_exercises_pkey ON public.structure_exercises USING btree (id);

CREATE UNIQUE INDEX structure_exercises_structure_id_exercise_id_key ON public.structure_exercises USING btree (structure_id, exercise_id);

CREATE UNIQUE INDEX structures_mesh_id_key ON public.structures USING btree (mesh_id);

CREATE UNIQUE INDEX structures_pkey ON public.structures USING btree (id);

CREATE UNIQUE INDEX suggestion_structures_pkey ON public.suggestion_structures USING btree (id);

CREATE UNIQUE INDEX suggestion_structures_suggestion_id_structure_id_key ON public.suggestion_structures USING btree (suggestion_id, structure_id);

CREATE UNIQUE INDEX user_exercises_pkey ON public.user_exercises USING btree (id);

CREATE UNIQUE INDEX user_exercises_user_id_exercise_id_key ON public.user_exercises USING btree (user_id, exercise_id);

CREATE UNIQUE INDEX user_profiles_pkey ON public.user_profiles USING btree (id);

CREATE UNIQUE INDEX user_profiles_stripe_customer_id_key ON public.user_profiles USING btree (stripe_customer_id);

alter table "public"."exercise_suggestions" add constraint "exercise_suggestions_pkey" PRIMARY KEY using index "exercise_suggestions_pkey";

alter table "public"."exercises" add constraint "exercises_pkey" PRIMARY KEY using index "exercises_pkey";

alter table "public"."structure_details" add constraint "structure_details_pkey" PRIMARY KEY using index "structure_details_pkey";

alter table "public"."structure_exercises" add constraint "structure_exercises_pkey" PRIMARY KEY using index "structure_exercises_pkey";

alter table "public"."structures" add constraint "structures_pkey" PRIMARY KEY using index "structures_pkey";

alter table "public"."suggestion_structures" add constraint "suggestion_structures_pkey" PRIMARY KEY using index "suggestion_structures_pkey";

alter table "public"."user_exercises" add constraint "user_exercises_pkey" PRIMARY KEY using index "user_exercises_pkey";

alter table "public"."user_profiles" add constraint "user_profiles_pkey" PRIMARY KEY using index "user_profiles_pkey";

alter table "public"."exercise_suggestions" add constraint "exercise_suggestions_difficulty_check" CHECK (((difficulty >= 1) AND (difficulty <= 5))) not valid;

alter table "public"."exercise_suggestions" validate constraint "exercise_suggestions_difficulty_check";

alter table "public"."exercise_suggestions" add constraint "exercise_suggestions_promoted_exercise_id_fkey" FOREIGN KEY (promoted_exercise_id) REFERENCES public.exercises(id) not valid;

alter table "public"."exercise_suggestions" validate constraint "exercise_suggestions_promoted_exercise_id_fkey";

alter table "public"."exercise_suggestions" add constraint "exercise_suggestions_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'rejected'::text, 'promoted'::text]))) not valid;

alter table "public"."exercise_suggestions" validate constraint "exercise_suggestions_status_check";

alter table "public"."exercise_suggestions" add constraint "exercise_suggestions_suggested_by_fkey" FOREIGN KEY (suggested_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."exercise_suggestions" validate constraint "exercise_suggestions_suggested_by_fkey";

alter table "public"."exercises" add constraint "exercises_contributed_by_fkey" FOREIGN KEY (contributed_by) REFERENCES auth.users(id) not valid;

alter table "public"."exercises" validate constraint "exercises_contributed_by_fkey";

alter table "public"."exercises" add constraint "exercises_difficulty_check" CHECK (((difficulty >= 1) AND (difficulty <= 5))) not valid;

alter table "public"."exercises" validate constraint "exercises_difficulty_check";

alter table "public"."exercises" add constraint "exercises_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) not valid;

alter table "public"."exercises" validate constraint "exercises_reviewed_by_fkey";

alter table "public"."exercises" add constraint "exercises_slug_key" UNIQUE using index "exercises_slug_key";

alter table "public"."exercises" add constraint "exercises_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'published'::text, 'rejected'::text]))) not valid;

alter table "public"."exercises" validate constraint "exercises_status_check";

alter table "public"."structure_details" add constraint "structure_details_structure_id_fkey" FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE not valid;

alter table "public"."structure_details" validate constraint "structure_details_structure_id_fkey";

alter table "public"."structure_details" add constraint "structure_details_structure_id_key" UNIQUE using index "structure_details_structure_id_key";

alter table "public"."structure_exercises" add constraint "structure_exercises_contributed_by_fkey" FOREIGN KEY (contributed_by) REFERENCES auth.users(id) not valid;

alter table "public"."structure_exercises" validate constraint "structure_exercises_contributed_by_fkey";

alter table "public"."structure_exercises" add constraint "structure_exercises_exercise_id_fkey" FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE CASCADE not valid;

alter table "public"."structure_exercises" validate constraint "structure_exercises_exercise_id_fkey";

alter table "public"."structure_exercises" add constraint "structure_exercises_involvement_check" CHECK ((involvement = ANY (ARRAY['primary'::text, 'secondary'::text, 'stabilizer'::text, 'stretched'::text]))) not valid;

alter table "public"."structure_exercises" validate constraint "structure_exercises_involvement_check";

alter table "public"."structure_exercises" add constraint "structure_exercises_status_check" CHECK ((status = ANY (ARRAY['pending_review'::text, 'published'::text, 'rejected'::text]))) not valid;

alter table "public"."structure_exercises" validate constraint "structure_exercises_status_check";

alter table "public"."structure_exercises" add constraint "structure_exercises_structure_id_exercise_id_key" UNIQUE using index "structure_exercises_structure_id_exercise_id_key";

alter table "public"."structure_exercises" add constraint "structure_exercises_structure_id_fkey" FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE not valid;

alter table "public"."structure_exercises" validate constraint "structure_exercises_structure_id_fkey";

alter table "public"."structures" add constraint "structures_mesh_id_key" UNIQUE using index "structures_mesh_id_key";

alter table "public"."suggestion_structures" add constraint "suggestion_structures_involvement_check" CHECK ((involvement = ANY (ARRAY['primary'::text, 'secondary'::text, 'stabilizer'::text, 'stretched'::text]))) not valid;

alter table "public"."suggestion_structures" validate constraint "suggestion_structures_involvement_check";

alter table "public"."suggestion_structures" add constraint "suggestion_structures_structure_id_fkey" FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE not valid;

alter table "public"."suggestion_structures" validate constraint "suggestion_structures_structure_id_fkey";

alter table "public"."suggestion_structures" add constraint "suggestion_structures_suggestion_id_fkey" FOREIGN KEY (suggestion_id) REFERENCES public.exercise_suggestions(id) ON DELETE CASCADE not valid;

alter table "public"."suggestion_structures" validate constraint "suggestion_structures_suggestion_id_fkey";

alter table "public"."suggestion_structures" add constraint "suggestion_structures_suggestion_id_structure_id_key" UNIQUE using index "suggestion_structures_suggestion_id_structure_id_key";

alter table "public"."suggestion_votes" add constraint "suggestion_votes_suggestion_id_fkey" FOREIGN KEY (suggestion_id) REFERENCES public.exercise_suggestions(id) ON DELETE CASCADE not valid;

alter table "public"."suggestion_votes" validate constraint "suggestion_votes_suggestion_id_fkey";

alter table "public"."suggestion_votes" add constraint "suggestion_votes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."suggestion_votes" validate constraint "suggestion_votes_user_id_fkey";

alter table "public"."suggestion_votes" add constraint "suggestion_votes_vote_check" CHECK ((vote = ANY (ARRAY['-1'::integer, 1]))) not valid;

alter table "public"."suggestion_votes" validate constraint "suggestion_votes_vote_check";

alter table "public"."user_exercises" add constraint "user_exercises_exercise_id_fkey" FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE CASCADE not valid;

alter table "public"."user_exercises" validate constraint "user_exercises_exercise_id_fkey";

alter table "public"."user_exercises" add constraint "user_exercises_user_id_exercise_id_key" UNIQUE using index "user_exercises_user_id_exercise_id_key";

alter table "public"."user_exercises" add constraint "user_exercises_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_exercises" validate constraint "user_exercises_user_id_fkey";

alter table "public"."user_profiles" add constraint "user_profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_profiles" validate constraint "user_profiles_id_fkey";

alter table "public"."user_profiles" add constraint "user_profiles_stripe_customer_id_key" UNIQUE using index "user_profiles_stripe_customer_id_key";

alter table "public"."user_profiles" add constraint "user_profiles_subscription_status_check" CHECK ((subscription_status = ANY (ARRAY['active'::text, 'past_due'::text, 'canceled'::text, 'trialing'::text, NULL::text]))) not valid;

alter table "public"."user_profiles" validate constraint "user_profiles_subscription_status_check";

alter table "public"."user_profiles" add constraint "user_profiles_tier_check" CHECK (((tier >= 0) AND (tier <= 2))) not valid;

alter table "public"."user_profiles" validate constraint "user_profiles_tier_check";

alter table "public"."user_profiles" add constraint "user_profiles_weight_unit_check" CHECK ((weight_unit = ANY (ARRAY['lbs'::text, 'kg'::text]))) not valid;

alter table "public"."user_profiles" validate constraint "user_profiles_weight_unit_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.check_suggestion_rate_limit(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.exercise_suggestions
  WHERE suggested_by = p_user_id
    AND created_at > NOW() - INTERVAL '24 hours';
  
  RETURN recent_count < 5;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_structure_suggestions(p_structure_id uuid, p_user_id uuid, p_limit integer DEFAULT 10, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, name text, description text, difficulty integer, equipment text[], video_url text, contributor_name text, suggested_by uuid, upvotes integer, downvotes integer, vote_ratio double precision, user_vote integer, involvement text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  -- perform set_config('search_path', 'public,pg_temp', true);
  insert into public.user_profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_suggestion_vote_counts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_exercises_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

grant delete on table "public"."exercise_suggestions" to "anon";

grant insert on table "public"."exercise_suggestions" to "anon";

grant references on table "public"."exercise_suggestions" to "anon";

grant select on table "public"."exercise_suggestions" to "anon";

grant trigger on table "public"."exercise_suggestions" to "anon";

grant truncate on table "public"."exercise_suggestions" to "anon";

grant update on table "public"."exercise_suggestions" to "anon";

grant delete on table "public"."exercise_suggestions" to "authenticated";

grant insert on table "public"."exercise_suggestions" to "authenticated";

grant references on table "public"."exercise_suggestions" to "authenticated";

grant select on table "public"."exercise_suggestions" to "authenticated";

grant trigger on table "public"."exercise_suggestions" to "authenticated";

grant truncate on table "public"."exercise_suggestions" to "authenticated";

grant update on table "public"."exercise_suggestions" to "authenticated";

grant delete on table "public"."exercise_suggestions" to "service_role";

grant insert on table "public"."exercise_suggestions" to "service_role";

grant references on table "public"."exercise_suggestions" to "service_role";

grant select on table "public"."exercise_suggestions" to "service_role";

grant trigger on table "public"."exercise_suggestions" to "service_role";

grant truncate on table "public"."exercise_suggestions" to "service_role";

grant update on table "public"."exercise_suggestions" to "service_role";

grant delete on table "public"."exercises" to "anon";

grant insert on table "public"."exercises" to "anon";

grant references on table "public"."exercises" to "anon";

grant select on table "public"."exercises" to "anon";

grant trigger on table "public"."exercises" to "anon";

grant truncate on table "public"."exercises" to "anon";

grant update on table "public"."exercises" to "anon";

grant delete on table "public"."exercises" to "authenticated";

grant insert on table "public"."exercises" to "authenticated";

grant references on table "public"."exercises" to "authenticated";

grant select on table "public"."exercises" to "authenticated";

grant trigger on table "public"."exercises" to "authenticated";

grant truncate on table "public"."exercises" to "authenticated";

grant update on table "public"."exercises" to "authenticated";

grant delete on table "public"."exercises" to "service_role";

grant insert on table "public"."exercises" to "service_role";

grant references on table "public"."exercises" to "service_role";

grant select on table "public"."exercises" to "service_role";

grant trigger on table "public"."exercises" to "service_role";

grant truncate on table "public"."exercises" to "service_role";

grant update on table "public"."exercises" to "service_role";

grant delete on table "public"."structure_details" to "anon";

grant insert on table "public"."structure_details" to "anon";

grant references on table "public"."structure_details" to "anon";

grant select on table "public"."structure_details" to "anon";

grant trigger on table "public"."structure_details" to "anon";

grant truncate on table "public"."structure_details" to "anon";

grant update on table "public"."structure_details" to "anon";

grant delete on table "public"."structure_details" to "authenticated";

grant insert on table "public"."structure_details" to "authenticated";

grant references on table "public"."structure_details" to "authenticated";

grant select on table "public"."structure_details" to "authenticated";

grant trigger on table "public"."structure_details" to "authenticated";

grant truncate on table "public"."structure_details" to "authenticated";

grant update on table "public"."structure_details" to "authenticated";

grant delete on table "public"."structure_details" to "service_role";

grant insert on table "public"."structure_details" to "service_role";

grant references on table "public"."structure_details" to "service_role";

grant select on table "public"."structure_details" to "service_role";

grant trigger on table "public"."structure_details" to "service_role";

grant truncate on table "public"."structure_details" to "service_role";

grant update on table "public"."structure_details" to "service_role";

grant delete on table "public"."structure_exercises" to "anon";

grant insert on table "public"."structure_exercises" to "anon";

grant references on table "public"."structure_exercises" to "anon";

grant select on table "public"."structure_exercises" to "anon";

grant trigger on table "public"."structure_exercises" to "anon";

grant truncate on table "public"."structure_exercises" to "anon";

grant update on table "public"."structure_exercises" to "anon";

grant delete on table "public"."structure_exercises" to "authenticated";

grant insert on table "public"."structure_exercises" to "authenticated";

grant references on table "public"."structure_exercises" to "authenticated";

grant select on table "public"."structure_exercises" to "authenticated";

grant trigger on table "public"."structure_exercises" to "authenticated";

grant truncate on table "public"."structure_exercises" to "authenticated";

grant update on table "public"."structure_exercises" to "authenticated";

grant delete on table "public"."structure_exercises" to "service_role";

grant insert on table "public"."structure_exercises" to "service_role";

grant references on table "public"."structure_exercises" to "service_role";

grant select on table "public"."structure_exercises" to "service_role";

grant trigger on table "public"."structure_exercises" to "service_role";

grant truncate on table "public"."structure_exercises" to "service_role";

grant update on table "public"."structure_exercises" to "service_role";

grant delete on table "public"."structures" to "anon";

grant insert on table "public"."structures" to "anon";

grant references on table "public"."structures" to "anon";

grant select on table "public"."structures" to "anon";

grant trigger on table "public"."structures" to "anon";

grant truncate on table "public"."structures" to "anon";

grant update on table "public"."structures" to "anon";

grant delete on table "public"."structures" to "authenticated";

grant insert on table "public"."structures" to "authenticated";

grant references on table "public"."structures" to "authenticated";

grant select on table "public"."structures" to "authenticated";

grant trigger on table "public"."structures" to "authenticated";

grant truncate on table "public"."structures" to "authenticated";

grant update on table "public"."structures" to "authenticated";

grant delete on table "public"."structures" to "service_role";

grant insert on table "public"."structures" to "service_role";

grant references on table "public"."structures" to "service_role";

grant select on table "public"."structures" to "service_role";

grant trigger on table "public"."structures" to "service_role";

grant truncate on table "public"."structures" to "service_role";

grant update on table "public"."structures" to "service_role";

grant delete on table "public"."suggestion_structures" to "anon";

grant insert on table "public"."suggestion_structures" to "anon";

grant references on table "public"."suggestion_structures" to "anon";

grant select on table "public"."suggestion_structures" to "anon";

grant trigger on table "public"."suggestion_structures" to "anon";

grant truncate on table "public"."suggestion_structures" to "anon";

grant update on table "public"."suggestion_structures" to "anon";

grant delete on table "public"."suggestion_structures" to "authenticated";

grant insert on table "public"."suggestion_structures" to "authenticated";

grant references on table "public"."suggestion_structures" to "authenticated";

grant select on table "public"."suggestion_structures" to "authenticated";

grant trigger on table "public"."suggestion_structures" to "authenticated";

grant truncate on table "public"."suggestion_structures" to "authenticated";

grant update on table "public"."suggestion_structures" to "authenticated";

grant delete on table "public"."suggestion_structures" to "service_role";

grant insert on table "public"."suggestion_structures" to "service_role";

grant references on table "public"."suggestion_structures" to "service_role";

grant select on table "public"."suggestion_structures" to "service_role";

grant trigger on table "public"."suggestion_structures" to "service_role";

grant truncate on table "public"."suggestion_structures" to "service_role";

grant update on table "public"."suggestion_structures" to "service_role";

grant delete on table "public"."suggestion_votes" to "anon";

grant insert on table "public"."suggestion_votes" to "anon";

grant references on table "public"."suggestion_votes" to "anon";

grant select on table "public"."suggestion_votes" to "anon";

grant trigger on table "public"."suggestion_votes" to "anon";

grant truncate on table "public"."suggestion_votes" to "anon";

grant update on table "public"."suggestion_votes" to "anon";

grant delete on table "public"."suggestion_votes" to "authenticated";

grant insert on table "public"."suggestion_votes" to "authenticated";

grant references on table "public"."suggestion_votes" to "authenticated";

grant select on table "public"."suggestion_votes" to "authenticated";

grant trigger on table "public"."suggestion_votes" to "authenticated";

grant truncate on table "public"."suggestion_votes" to "authenticated";

grant update on table "public"."suggestion_votes" to "authenticated";

grant delete on table "public"."suggestion_votes" to "service_role";

grant insert on table "public"."suggestion_votes" to "service_role";

grant references on table "public"."suggestion_votes" to "service_role";

grant select on table "public"."suggestion_votes" to "service_role";

grant trigger on table "public"."suggestion_votes" to "service_role";

grant truncate on table "public"."suggestion_votes" to "service_role";

grant update on table "public"."suggestion_votes" to "service_role";

grant delete on table "public"."user_exercises" to "anon";

grant insert on table "public"."user_exercises" to "anon";

grant references on table "public"."user_exercises" to "anon";

grant select on table "public"."user_exercises" to "anon";

grant trigger on table "public"."user_exercises" to "anon";

grant truncate on table "public"."user_exercises" to "anon";

grant update on table "public"."user_exercises" to "anon";

grant delete on table "public"."user_exercises" to "authenticated";

grant insert on table "public"."user_exercises" to "authenticated";

grant references on table "public"."user_exercises" to "authenticated";

grant select on table "public"."user_exercises" to "authenticated";

grant trigger on table "public"."user_exercises" to "authenticated";

grant truncate on table "public"."user_exercises" to "authenticated";

grant update on table "public"."user_exercises" to "authenticated";

grant delete on table "public"."user_exercises" to "service_role";

grant insert on table "public"."user_exercises" to "service_role";

grant references on table "public"."user_exercises" to "service_role";

grant select on table "public"."user_exercises" to "service_role";

grant trigger on table "public"."user_exercises" to "service_role";

grant truncate on table "public"."user_exercises" to "service_role";

grant update on table "public"."user_exercises" to "service_role";

grant delete on table "public"."user_profiles" to "anon";

grant insert on table "public"."user_profiles" to "anon";

grant references on table "public"."user_profiles" to "anon";

grant select on table "public"."user_profiles" to "anon";

grant trigger on table "public"."user_profiles" to "anon";

grant truncate on table "public"."user_profiles" to "anon";

grant update on table "public"."user_profiles" to "anon";

grant delete on table "public"."user_profiles" to "authenticated";

grant insert on table "public"."user_profiles" to "authenticated";

grant references on table "public"."user_profiles" to "authenticated";

grant select on table "public"."user_profiles" to "authenticated";

grant trigger on table "public"."user_profiles" to "authenticated";

grant truncate on table "public"."user_profiles" to "authenticated";

grant update on table "public"."user_profiles" to "authenticated";

grant delete on table "public"."user_profiles" to "service_role";

grant insert on table "public"."user_profiles" to "service_role";

grant references on table "public"."user_profiles" to "service_role";

grant select on table "public"."user_profiles" to "service_role";

grant trigger on table "public"."user_profiles" to "service_role";

grant truncate on table "public"."user_profiles" to "service_role";

grant update on table "public"."user_profiles" to "service_role";


  create policy "Premium users can suggest exercises"
  on "public"."exercise_suggestions"
  as permissive
  for insert
  to public
with check (((suggested_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = ( SELECT auth.uid() AS uid)) AND (user_profiles.tier >= 1))))));



  create policy "Premium users can view pending suggestions"
  on "public"."exercise_suggestions"
  as permissive
  for select
  to public
using (((status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = ( SELECT auth.uid() AS uid)) AND (user_profiles.tier >= 1))))));



  create policy "Users can delete own pending suggestions"
  on "public"."exercise_suggestions"
  as permissive
  for delete
  to public
using (((suggested_by = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text)));



  create policy "Users can update own pending suggestions"
  on "public"."exercise_suggestions"
  as permissive
  for update
  to public
using (((suggested_by = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text)))
with check (((suggested_by = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text)));



  create policy "Users can view own suggestions"
  on "public"."exercise_suggestions"
  as permissive
  for select
  to public
using ((suggested_by = ( SELECT auth.uid() AS uid)));



  create policy "exercises_paid_read"
  on "public"."exercises"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = ( SELECT auth.uid() AS uid)) AND (user_profiles.tier >= 1)))));



  create policy "free_tier_read"
  on "public"."structure_details"
  as permissive
  for select
  to public
using (true);



  create policy "structure_exercises_paid_read"
  on "public"."structure_exercises"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = ( SELECT auth.uid() AS uid)) AND (user_profiles.tier >= 1)))));



  create policy "structures_public_read"
  on "public"."structures"
  as permissive
  for select
  to public
using (true);



  create policy "Delete suggestion structures for own suggestions"
  on "public"."suggestion_structures"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.exercise_suggestions es
  WHERE ((es.id = suggestion_structures.suggestion_id) AND (es.suggested_by = ( SELECT auth.uid() AS uid))))));



  create policy "Insert suggestion structures for own suggestions"
  on "public"."suggestion_structures"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.exercise_suggestions es
  WHERE ((es.id = suggestion_structures.suggestion_id) AND (es.suggested_by = ( SELECT auth.uid() AS uid))))));



  create policy "View suggestion structures"
  on "public"."suggestion_structures"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.exercise_suggestions es
  WHERE ((es.id = suggestion_structures.suggestion_id) AND (((es.status = 'pending'::text) AND (EXISTS ( SELECT 1
           FROM public.user_profiles
          WHERE ((user_profiles.id = ( SELECT auth.uid() AS uid)) AND (user_profiles.tier >= 1))))) OR (es.suggested_by = ( SELECT auth.uid() AS uid)))))));



  create policy "Premium users can view votes"
  on "public"."suggestion_votes"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = ( SELECT auth.uid() AS uid)) AND (user_profiles.tier >= 1)))));



  create policy "Premium users can vote"
  on "public"."suggestion_votes"
  as permissive
  for insert
  to public
with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = ( SELECT auth.uid() AS uid)) AND (user_profiles.tier >= 1))))));



  create policy "Users can delete own vote"
  on "public"."suggestion_votes"
  as permissive
  for delete
  to public
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can update own vote"
  on "public"."suggestion_votes"
  as permissive
  for update
  to public
using ((user_id = ( SELECT auth.uid() AS uid)))
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "user_exercises_delete_own"
  on "public"."user_exercises"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "user_exercises_insert_own"
  on "public"."user_exercises"
  as permissive
  for insert
  to public
with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.tier >= 1))))));



  create policy "user_exercises_select_own"
  on "public"."user_exercises"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "user_exercises_update_own"
  on "public"."user_exercises"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "profiles_read_own"
  on "public"."user_profiles"
  as permissive
  for select
  to public
using ((auth.uid() = id));



  create policy "profiles_update_own"
  on "public"."user_profiles"
  as permissive
  for update
  to public
using ((auth.uid() = id));


CREATE TRIGGER trigger_update_vote_counts AFTER INSERT OR DELETE OR UPDATE ON public.suggestion_votes FOR EACH ROW EXECUTE FUNCTION public.update_suggestion_vote_counts();

CREATE TRIGGER user_exercises_updated_at BEFORE UPDATE ON public.user_exercises FOR EACH ROW EXECUTE FUNCTION public.update_user_exercises_updated_at();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


