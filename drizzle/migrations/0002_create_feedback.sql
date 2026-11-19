CREATE TABLE public.feedback (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  page text NOT NULL DEFAULT '' CHECK (char_length(page) <= 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;