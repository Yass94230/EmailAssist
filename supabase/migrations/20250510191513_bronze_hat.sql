/*
  # Correction des politiques d'authentification

  1. Sécurité
    - Active RLS sur la table auth.users
    - Ajoute des politiques pour permettre aux utilisateurs de:
      - Lire leur propre profil
      - Mettre à jour leur propre profil
    - Donne accès complet au rôle service_role
*/

-- Activer RLS sur la table auth.users
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre aux utilisateurs de lire leur propre profil
CREATE POLICY "Users can read own profile"
ON auth.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Politique pour permettre aux utilisateurs de mettre à jour leur propre profil
CREATE POLICY "Users can update own profile"
ON auth.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Politique pour donner un accès complet au rôle service_role
CREATE POLICY "Service role has full access to users"
ON auth.users
TO service_role
USING (true)
WITH CHECK (true);