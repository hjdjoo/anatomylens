-- ============================================================
-- USER EXERCISES TABLE
-- Stores exercises saved to a user's personal library
-- ============================================================

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

-- Set ownership
ALTER TABLE "public"."user_exercises" OWNER TO "postgres";

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_user_exercises_user_id ON "public"."user_exercises"("user_id");
CREATE INDEX idx_user_exercises_exercise_id ON "public"."user_exercises"("exercise_id");
CREATE INDEX idx_user_exercises_added_at ON "public"."user_exercises"("user_id", "added_at" DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

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

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

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

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

-- ============================================================
-- GRANTS
-- ============================================================

GRANT ALL ON TABLE "public"."user_exercises" TO "anon";
GRANT ALL ON TABLE "public"."user_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."user_exercises" TO "service_role";