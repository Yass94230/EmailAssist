/*
  # Gmail Credentials Table

  1. New Tables
    - `gmail_credentials`
      - `id` (serial, primary key)
      - `phone_number` (text, unique)
      - `email` (text)
      - `access_token` (text)
      - `refresh_token` (text, nullable)
      - `token_expires_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `gmail_credentials` table
*/

CREATE TABLE IF NOT EXISTS gmail_credentials (
  id serial PRIMARY KEY,
  phone_number text UNIQUE NOT NULL,
  email text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gmail_credentials ENABLE ROW LEVEL SECURITY;