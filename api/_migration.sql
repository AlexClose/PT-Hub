-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query)

CREATE TABLE IF NOT EXISTS api_tokens (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id         uuid        NOT NULL,
  token_hash        text        UNIQUE NOT NULL,
  label             text        DEFAULT '',
  revoked_at        timestamptz,
  created_at        timestamptz DEFAULT now(),
  request_count     int         DEFAULT 0,
  rate_window_start timestamptz DEFAULT now()
);

ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select" ON api_tokens FOR SELECT USING (true);

-- Atomic rate-limit tick called by the API on every request.
-- SECURITY DEFINER lets the anon role update the row despite RLS.
CREATE OR REPLACE FUNCTION tick_api_token(p_hash text)
RETURNS TABLE(cnt int, window_start timestamptz, client_id uuid, revoked_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r api_tokens%ROWTYPE;
BEGIN
  SELECT * INTO r FROM api_tokens WHERE token_hash = p_hash;
  IF NOT FOUND THEN RETURN; END IF;

  IF now() - r.rate_window_start > INTERVAL '1 hour' THEN
    r.request_count     := 1;
    r.rate_window_start := now();
  ELSE
    r.request_count := r.request_count + 1;
  END IF;

  UPDATE api_tokens
  SET    request_count = r.request_count,
         rate_window_start = r.rate_window_start
  WHERE  token_hash = p_hash;

  RETURN QUERY SELECT r.request_count, r.rate_window_start, r.client_id, r.revoked_at;
END;
$$;

GRANT EXECUTE ON FUNCTION tick_api_token(text) TO anon;

-- Pre-minted token for Chris Lavergne
-- Plaintext (share with Chris): pt_623eada17872f337ba23ff7e51f929e1c2886250932fdfd1771e838815700b68
INSERT INTO api_tokens (client_id, token_hash, label)
VALUES (
  '761e9a06-c9f8-4d2c-b5ac-468b7ebd7d8b',
  '1bfd697a68c6f2d0991250795cc31ffb3b2953efc02192ccde01e84c7e8f5552',
  'Chris Lavergne — primary'
);
