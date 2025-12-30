import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://sxtktdsknqhrclimcjns.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4dGt0ZHNrbnFocmNsaW1jam5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwODM3MDMsImV4cCI6MjA4MjY1OTcwM30.WFFpSVn0eDaF3eqa6wwRtC-81almKzatYnO7q3UgsDc";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ===== AUTH HELPERS =====

export async function signUp(email, password) {
  const { error } = await supabase.auth.signUp({
    email,
    password
  });
  if (error) throw error;
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function currentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}
