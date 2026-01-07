-- Migration: Exercise Suggestions System
-- Allows premium users to suggest exercises and vote on community suggestions

-- ============================================================
-- TABLES
-- ============================================================

-- Main suggestions table
CREATE TABLE IF NOT EXISTS public.exercise_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  difficulty INTEGER NOT NULL CHECK (difficulty >= 1 AND difficulty <= 5),
  equipment TEXT[] DEFAULT '{}',
  video_url TEXT,
  
  -- Contributor info
  suggested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contributor_name TEXT, -- Denormalized for display
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rejected', 'promoted')),
  rejection_reason TEXT,
  
  -- Vote counts (denormalized for query performance)
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- If promoted, link to the created exercise
  promoted_at TIMESTAMPTZ,
  promoted_exercise_id UUID REFERENCES public.exercises(id)
);

-- Structure mappings for suggestions (which muscles does this exercise work?)
CREATE TABLE IF NOT EXISTS public.suggestion_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES public.exercise_suggestions(id) ON DELETE CASCADE,
  structure_id UUID NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  involvement TEXT NOT NULL CHECK (involvement IN ('primary', 'secondary', 'stabilizer', 'stretched')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One mapping per structure per suggestion
  UNIQUE (suggestion_id, structure_id)
);

-- User votes on suggestions
CREATE TABLE IF NOT EXISTS public.suggestion_votes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestion_id UUID NOT NULL REFERENCES public.exercise_suggestions(id) ON DELETE CASCADE,
  vote INTEGER NOT NULL CHECK (vote IN (-1, 1)), -- -1 = downvote, 1 = upvote
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (user_id, suggestion_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

-- For fetching suggestions for a specific structure
CREATE INDEX IF NOT EXISTS idx_suggestion_structures_structure 
  ON public.suggestion_structures(structure_id);

-- For fetching suggestions by status and sorting by score
CREATE INDEX IF NOT EXISTS idx_suggestions_status_votes 
  ON public.exercise_suggestions(status, upvotes DESC, downvotes);

-- For rate limiting checks
CREATE INDEX IF NOT EXISTS idx_suggestions_user_created 
  ON public.exercise_suggestions(suggested_by, created_at DESC);

-- For user's vote lookup
CREATE INDEX IF NOT EXISTS idx_votes_user 
  ON public.suggestion_votes(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.exercise_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestion_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestion_votes ENABLE ROW LEVEL SECURITY;

-- Suggestions: Premium users can view all pending suggestions
CREATE POLICY "Premium users can view pending suggestions"
  ON public.exercise_suggestions
  FOR SELECT
  USING (
    status = 'pending' 
    AND EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND tier >= 1
    )
  );

-- Suggestions: Users can view their own suggestions regardless of status
CREATE POLICY "Users can view own suggestions"
  ON public.exercise_suggestions
  FOR SELECT
  USING (suggested_by = auth.uid());

-- Suggestions: Premium users can insert (rate limit enforced at app level)
CREATE POLICY "Premium users can suggest exercises"
  ON public.exercise_suggestions
  FOR INSERT
  WITH CHECK (
    suggested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND tier >= 1
    )
  );

-- Suggestions: Users can update their own pending suggestions
CREATE POLICY "Users can update own pending suggestions"
  ON public.exercise_suggestions
  FOR UPDATE
  USING (suggested_by = auth.uid() AND status = 'pending')
  WITH CHECK (suggested_by = auth.uid() AND status = 'pending');

-- Suggestions: Users can delete their own pending suggestions
CREATE POLICY "Users can delete own pending suggestions"
  ON public.exercise_suggestions
  FOR DELETE
  USING (suggested_by = auth.uid() AND status = 'pending');

-- Suggestion structures: Viewable if parent suggestion is viewable
CREATE POLICY "View suggestion structures"
  ON public.suggestion_structures
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exercise_suggestions es
      WHERE es.id = suggestion_id
      AND (
        es.status = 'pending' AND EXISTS (
          SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND tier >= 1
        )
        OR es.suggested_by = auth.uid()
      )
    )
  );

-- Suggestion structures: Insert if user owns the suggestion
CREATE POLICY "Insert suggestion structures for own suggestions"
  ON public.suggestion_structures
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exercise_suggestions es
      WHERE es.id = suggestion_id AND es.suggested_by = auth.uid()
    )
  );

-- Suggestion structures: Delete if user owns the suggestion
CREATE POLICY "Delete suggestion structures for own suggestions"
  ON public.suggestion_structures
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.exercise_suggestions es
      WHERE es.id = suggestion_id AND es.suggested_by = auth.uid()
    )
  );

-- Votes: Premium users can view all votes
CREATE POLICY "Premium users can view votes"
  ON public.suggestion_votes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND tier >= 1
    )
  );

-- Votes: Premium users can insert/update their vote
CREATE POLICY "Premium users can vote"
  ON public.suggestion_votes
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND tier >= 1
    )
  );

-- Votes: Users can update their own vote
CREATE POLICY "Users can update own vote"
  ON public.suggestion_votes
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Votes: Users can delete their own vote
CREATE POLICY "Users can delete own vote"
  ON public.suggestion_votes
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to update vote counts when votes change
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

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.exercise_suggestions IS 'User-submitted exercise suggestions for community review';
COMMENT ON TABLE public.suggestion_structures IS 'Muscle/structure mappings for exercise suggestions';
COMMENT ON TABLE public.suggestion_votes IS 'User votes on exercise suggestions';
COMMENT ON FUNCTION public.check_suggestion_rate_limit IS 'Check if user can submit more suggestions (5 per 24h limit)';
COMMENT ON FUNCTION public.get_structure_suggestions IS 'Get paginated suggestions for a structure with vote info';
