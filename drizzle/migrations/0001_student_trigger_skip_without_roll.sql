create or replace function public.handle_new_student() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_roll text := upper(trim(coalesce(new.raw_user_meta_data->>'roll_no','')));
begin
  if v_roll !~ '^(11|12)[A-Z]_\d{1,2}$' then return new; end if;
  insert into public.students(roll_no, name, class_label, user_id, email)
  values (v_roll,
          left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''), v_roll), 80),
          substr(v_roll, 1, 3), new.id, lower(new.email));
  return new;
end $$;