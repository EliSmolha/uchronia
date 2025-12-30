import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://sxtktdsknqhrclimcjns.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4dGt0ZHNrbnFocmNsaW1jam5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwODM3MDMsImV4cCI6MjA4MjY1OTcwM30.WFFpSVn0eDaF3eqa6wwRtC-81almKzatYnO7q3UgsDc";

// Важно: ключ anon публичный — это нормально. Безопасность обеспечивает RLS в БД.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Supabase-js по умолчанию хранит сессию и подтягивает её из URL после подтверждения email.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// =======================
// AUTH HELPERS
// =======================

function normalizeEmail(email) {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Регистрация (email+password).
 * Если включён Confirm email, пользователь станет "активным" только после клика по ссылке в письме.
 */
export async function signUp(email, password) {
  email = normalizeEmail(email);
  if (!email || !password) throw new Error("Введите email и пароль.");

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

/**
 * Вход (email+password).
 */
export async function signIn(email, password) {
  email = normalizeEmail(email);
  if (!email || !password) throw new Error("Введите email и пароль.");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/**
 * Выход.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Текущий пользователь (может быть null).
 * Удобно для "проверить доступ" перед созданием темы/коммента.
 */
export async function currentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

/**
 * Текущая сессия (может быть null).
 * Полезно, если тебе нужно не только user, но и access_token.
 */
export async function currentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session ?? null;
}

/**
 * Подписка на изменения авторизации.
 * Использование:
 *   const unsub = onAuthChange((user, session) => { ... });
 *   ... позже ...
 *   unsub();
 */
export function onAuthChange(handler) {
  const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
    handler(session?.user ?? null, session ?? null, event);
  });

  return () => subscription?.subscription?.unsubscribe();
}

// =======================
// FORUM HELPERS (минимум)
// =======================

export const SECTION = Object.freeze({
  FESTIVALS: "festivals",
  DUELS: "duels",
  FLOOD: "flood",
  RULES: "rules"
});

/**
 * Список тем по разделу (или все, если section не передан).
 */
export async function listThreads({ section = null, limit = 50 } = {}) {
  let q = supabase
    .from("threads")
    .select("id, title, created_at, author_id, section")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (section) q = q.eq("section", section);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/**
 * Создать тему в конкретном разделе.
 * Требует логина (RLS в БД дополнительно защитит).
 */
export async function createThread({ title, body_md, section }) {
  const user = await currentUser();
  if (!user) throw new Error("Войдите, чтобы создавать темы.");

  title = (title ?? "").trim();
  body_md = (body_md ?? "").trim();
  section = (section ?? "").trim();

  if (title.length < 3) throw new Error("Заголовок слишком короткий.");
  if (!body_md) throw new Error("Текст темы пустой.");
  if (!section) throw new Error("Не задан раздел.");

  const { error } = await supabase
    .from("threads")
    .insert({
      author_id: user.id,
      title,
      body_md,
      section
    });

  if (error) throw error;
}
