
import { createClient } from '@supabase/supabase-js';

/*
راهنما برای مبتدی‌ها:
۱. به پنل Supabase بروید.
۲. وارد بخش Settings (چرخ‌دنده) > API شوید.
۳. مقدار Project URL را کپی کنید و به جای متن داخل کوتیشن اول بگذارید.
۴. مقدار anon public key را کپی کنید و به جای متن داخل کوتیشن دوم بگذارید.
*/

const SUPABASE_URL = 'https://ffbbykkvoqboofsrormb.supabase.co'; // آدرس اختصاصی شما
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmYmJ5a2t2b3Fib29mc3Jvcm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNDk0NjQsImV4cCI6MjA4MTYyNTQ2NH0.-CN7nOKgfclbibD7FKVOqs9HWid2CmHhMAjSOyBtmK8'; // کلید اختصاصی شما

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
