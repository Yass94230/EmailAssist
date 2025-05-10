import { supabase } from './supabase';

export async function signInWithPhone(phoneNumber: string) {
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: phoneNumber
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw error;
  }
}

export async function verifyOtp(phoneNumber: string, token: string) {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phoneNumber,
      token: token,
      type: 'sms'
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw error;
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}