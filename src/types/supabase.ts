export interface Database {
  public: {
    Tables: {
      user_settings: {
        Row: {
          id: string;
          phone_number: string;
          audio_enabled: boolean;
          voice_type: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          phone_number: string;
          audio_enabled?: boolean;
          voice_type?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          phone_number?: string;
          audio_enabled?: boolean;
          voice_type?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      email_credentials: {
        Row: {
          id: number;
          phone_number: string;
          email: string;
          provider: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          phone_number: string;
          email: string;
          provider: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          phone_number?: string;
          email?: string;
          provider?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_whatsapp: {
        Row: {
          id: string;
          phone_number: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          phone_number: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          phone_number?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}