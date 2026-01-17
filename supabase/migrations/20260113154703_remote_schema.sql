drop policy "Premium users can suggest exercises" on "public"."exercise_suggestions";

drop policy "Premium users can view pending suggestions" on "public"."exercise_suggestions";

drop policy "Users can delete own pending suggestions" on "public"."exercise_suggestions";

drop policy "Users can update own pending suggestions" on "public"."exercise_suggestions";

drop policy "Users can view own suggestions" on "public"."exercise_suggestions";

drop policy "Delete suggestion structures for own suggestions" on "public"."suggestion_structures";

drop policy "Insert suggestion structures for own suggestions" on "public"."suggestion_structures";

drop policy "View suggestion structures" on "public"."suggestion_structures";

drop policy "Premium users can view votes" on "public"."suggestion_votes";

drop policy "Premium users can vote" on "public"."suggestion_votes";

drop policy "Users can delete own vote" on "public"."suggestion_votes";

drop policy "Users can update own vote" on "public"."suggestion_votes";

CREATE UNIQUE INDEX suggestion_votes_pkey ON public.suggestion_votes USING btree (user_id, suggestion_id);

alter table "public"."suggestion_votes" add constraint "suggestion_votes_pkey" PRIMARY KEY using index "suggestion_votes_pkey";


  create policy "Premium users can suggest exercises"
  on "public"."exercise_suggestions"
  as permissive
  for insert
  to public
with check (((suggested_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.tier >= 1))))));



  create policy "Premium users can view pending suggestions"
  on "public"."exercise_suggestions"
  as permissive
  for select
  to public
using (((status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.tier >= 1))))));



  create policy "Users can delete own pending suggestions"
  on "public"."exercise_suggestions"
  as permissive
  for delete
  to public
using (((suggested_by = auth.uid()) AND (status = 'pending'::text)));



  create policy "Users can update own pending suggestions"
  on "public"."exercise_suggestions"
  as permissive
  for update
  to public
using (((suggested_by = auth.uid()) AND (status = 'pending'::text)))
with check (((suggested_by = auth.uid()) AND (status = 'pending'::text)));



  create policy "Users can view own suggestions"
  on "public"."exercise_suggestions"
  as permissive
  for select
  to public
using ((suggested_by = auth.uid()));



  create policy "Delete suggestion structures for own suggestions"
  on "public"."suggestion_structures"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.exercise_suggestions es
  WHERE ((es.id = suggestion_structures.suggestion_id) AND (es.suggested_by = auth.uid())))));



  create policy "Insert suggestion structures for own suggestions"
  on "public"."suggestion_structures"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.exercise_suggestions es
  WHERE ((es.id = suggestion_structures.suggestion_id) AND (es.suggested_by = auth.uid())))));



  create policy "View suggestion structures"
  on "public"."suggestion_structures"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.exercise_suggestions es
  WHERE ((es.id = suggestion_structures.suggestion_id) AND (((es.status = 'pending'::text) AND (EXISTS ( SELECT 1
           FROM public.user_profiles
          WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.tier >= 1))))) OR (es.suggested_by = auth.uid()))))));



  create policy "Premium users can view votes"
  on "public"."suggestion_votes"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.tier >= 1)))));



  create policy "Premium users can vote"
  on "public"."suggestion_votes"
  as permissive
  for insert
  to public
with check (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.tier >= 1))))));



  create policy "Users can delete own vote"
  on "public"."suggestion_votes"
  as permissive
  for delete
  to public
using ((user_id = auth.uid()));



  create policy "Users can update own vote"
  on "public"."suggestion_votes"
  as permissive
  for update
  to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



