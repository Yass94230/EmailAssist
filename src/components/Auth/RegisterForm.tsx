// Modifiez la fonction handleSubmit dans RegisterForm.tsx

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);

  if (password !== confirmPassword) {
    setError('Les mots de passe ne correspondent pas');
    return;
  }

  setIsLoading(true);

  try {
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          email_confirmed: true // Auto-confirm email for direct access
        }
      }
    });

    if (signUpError) {
      if (signUpError.message === 'User already registered') {
        throw new Error('Un compte existe déjà avec cet email. Veuillez vous connecter.');
      }
      throw signUpError;
    }

    if (data?.user) {
      console.log('Inscription réussie:', data.user.email);
      
      // Create default user settings
      const { error: settingsError } = await supabase
        .from('user_settings')
        .insert({
          user_id: data.user.id,
          audio_enabled: true,
          voice_recognition_enabled: true,
          voice_type: 'alloy'
        });

      if (settingsError) {
        console.error('Error creating user settings:', settingsError);
      }

      // Appeler onSuccess
      onSuccess();
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erreur lors de l\'inscription';
    setError(errorMessage);
    
    if (errorMessage.includes('compte existe déjà')) {
      setTimeout(() => {
        const loginButton = document.querySelector('button[type="button"]');
        if (loginButton) {
          loginButton.classList.add('animate-pulse');
          setTimeout(() => loginButton.classList.remove('animate-pulse'), 2000);
        }
      }, 100);
    }
  } finally {
    setIsLoading(false);
  }
};