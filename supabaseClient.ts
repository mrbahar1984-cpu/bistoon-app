
import { createClient } from '@supabase/supabase-js';

// مقادیر اختصاصی شما با موفقیت جایگذاری شد
const SUPABASE_URL = 'https://ffbbykkvoqboofsrormb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmYmJ5a2t2b3Fib29mc3Jvcm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNDk0NjQsImV4cCI6MjA4MTYyNTQ2NH0.-CN7nOKgfclbibD7FKVOqs9HWid2CmHhMAjSOyBtmK8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
