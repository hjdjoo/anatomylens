
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

CREATE INDEX idx_user_exercises_added_at ON public.user_exercises USING btree (user_id, added_at DESC);

CREATE INDEX idx_user_exercises_exercise_id ON public.user_exercises USING btree (exercise_id);

CREATE INDEX idx_user_exercises_user_id ON public.user_exercises USING btree (user_id);

CREATE UNIQUE INDEX user_exercises_pkey ON public.user_exercises USING btree (id);

CREATE UNIQUE INDEX user_exercises_user_id_exercise_id_key ON public.user_exercises USING btree (user_id, exercise_id);

alter table "public"."user_exercises" add constraint "user_exercises_pkey" PRIMARY KEY using index "user_exercises_pkey";

alter table "public"."user_exercises" add constraint "user_exercises_exercise_id_fkey" FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE CASCADE not valid;

alter table "public"."user_exercises" validate constraint "user_exercises_exercise_id_fkey";

alter table "public"."user_exercises" add constraint "user_exercises_user_id_exercise_id_key" UNIQUE using index "user_exercises_user_id_exercise_id_key";

alter table "public"."user_exercises" add constraint "user_exercises_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_exercises" validate constraint "user_exercises_user_id_fkey";

set check_function_bodies = off;

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


CREATE TRIGGER user_exercises_updated_at BEFORE UPDATE ON public.user_exercises FOR EACH ROW EXECUTE FUNCTION public.update_user_exercises_updated_at();


