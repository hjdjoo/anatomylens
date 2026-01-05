create extension if not exists "pg_net" with schema "extensions";

drop policy "clinical_tier2_read" on "public"."structure_clinical";

revoke delete on table "public"."structure_clinical" from "anon";

revoke insert on table "public"."structure_clinical" from "anon";

revoke references on table "public"."structure_clinical" from "anon";

revoke select on table "public"."structure_clinical" from "anon";

revoke trigger on table "public"."structure_clinical" from "anon";

revoke truncate on table "public"."structure_clinical" from "anon";

revoke update on table "public"."structure_clinical" from "anon";

revoke delete on table "public"."structure_clinical" from "authenticated";

revoke insert on table "public"."structure_clinical" from "authenticated";

revoke references on table "public"."structure_clinical" from "authenticated";

revoke select on table "public"."structure_clinical" from "authenticated";

revoke trigger on table "public"."structure_clinical" from "authenticated";

revoke truncate on table "public"."structure_clinical" from "authenticated";

revoke update on table "public"."structure_clinical" from "authenticated";

revoke delete on table "public"."structure_clinical" from "service_role";

revoke insert on table "public"."structure_clinical" from "service_role";

revoke references on table "public"."structure_clinical" from "service_role";

revoke select on table "public"."structure_clinical" from "service_role";

revoke trigger on table "public"."structure_clinical" from "service_role";

revoke truncate on table "public"."structure_clinical" from "service_role";

revoke update on table "public"."structure_clinical" from "service_role";

alter table "public"."structure_clinical" drop constraint "structure_clinical_contributed_by_fkey";

alter table "public"."structure_clinical" drop constraint "structure_clinical_structure_id_fkey";

alter table "public"."structure_clinical" drop constraint "structure_clinical_structure_id_key";

alter table "public"."structure_clinical" drop constraint "structure_clinical_pkey";

drop index if exists "public"."structure_clinical_pkey";

drop index if exists "public"."structure_clinical_structure_id_key";

drop table "public"."structure_clinical";


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

CREATE INDEX idx_structure_details_structure_id ON public.structure_details USING btree (structure_id);

CREATE UNIQUE INDEX structure_details_pkey ON public.structure_details USING btree (id);

CREATE UNIQUE INDEX structure_details_structure_id_key ON public.structure_details USING btree (structure_id);

alter table "public"."structure_details" add constraint "structure_details_pkey" PRIMARY KEY using index "structure_details_pkey";

alter table "public"."structure_details" add constraint "structure_details_structure_id_fkey" FOREIGN KEY (structure_id) REFERENCES public.structures(id) ON DELETE CASCADE not valid;

alter table "public"."structure_details" validate constraint "structure_details_structure_id_fkey";

alter table "public"."structure_details" add constraint "structure_details_structure_id_key" UNIQUE using index "structure_details_structure_id_key";

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


  create policy "free_tier_read"
  on "public"."structure_details"
  as permissive
  for select
  to public
using (true);


drop trigger if exists "on_auth_user_created" on "auth"."users";


