create extension if not exists pgcrypto with schema extensions;

create table public.students (
  id serial primary key,
  roll_no text not null unique,
  name text not null,
  user_id uuid unique,
  email text unique,
  class_label text not null,
  created_at timestamptz not null default now()
);

create table public.rooms (
  id serial primary key,
  name text not null,
  type text not null check (type in ('classroom','library')),
  total_seats int not null default 0,
  location_note text not null default '',
  is_active boolean not null default true
);

create table public.seats (
  id serial primary key,
  room_id int not null references public.rooms(id) on delete cascade,
  label text not null,
  is_active boolean not null default true,
  unique (room_id, label)
);

create table public.periods (
  id serial primary key,
  name text not null,
  start_time time not null,
  end_time time not null,
  is_break boolean not null default false,
  sort_order int not null default 0
);

create table public.room_blocks (
  id serial primary key,
  room_id int not null references public.rooms(id) on delete cascade,
  period_id int not null references public.periods(id) on delete cascade,
  weekday int not null check (weekday between 1 and 7),
  reason text not null default ''
);

create sequence public.booking_code_seq;

create table public.bookings (
  id serial primary key,
  booking_code text not null unique default ('SS' || lpad(nextval('public.booking_code_seq')::text, 3, '0')),
  student_id int not null references public.students(id) on delete cascade,
  room_id int not null references public.rooms(id) on delete cascade,
  seat_id int not null references public.seats(id) on delete cascade,
  period_id int not null references public.periods(id) on delete cascade,
  date date not null,
  status text not null default 'active' check (status in ('active','cancelled','expired')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create unique index bookings_seat_active_uniq on public.bookings (seat_id, period_id, date) where status = 'active';
create unique index bookings_student_active_uniq on public.bookings (student_id, period_id, date) where status = 'active';
create index bookings_date_period_room_idx on public.bookings (date, period_id, room_id);
create index bookings_student_date_idx on public.bookings (student_id, date);

create table public.sessions (
  token text primary key,
  student_id int references public.students(id) on delete cascade,
  is_admin boolean not null default false,
  expires_at timestamptz not null
);

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0
);

grant all on public.students, public.rooms, public.seats, public.periods, public.room_blocks,
  public.bookings, public.sessions, public.rate_limits to service_role;
grant usage, select, update on all sequences in schema public to service_role;

alter table public.students enable row level security;
alter table public.rooms enable row level security;
alter table public.seats enable row level security;
alter table public.periods enable row level security;
alter table public.room_blocks enable row level security;
alter table public.bookings enable row level security;
alter table public.sessions enable row level security;
alter table public.rate_limits enable row level security;

create or replace function public.ist_now() returns timestamp language sql stable set search_path = public as $$
  select (now() at time zone 'Asia/Kolkata')
$$;

create or replace function public.expire_bookings() returns void language sql set search_path = public as $$
  update public.bookings b set status = 'expired'
  from public.periods p
  where b.period_id = p.id and b.status = 'active'
    and (b.date < public.ist_now()::date
         or (b.date = public.ist_now()::date and p.end_time <= public.ist_now()::time));
$$;

create or replace function public.hit_rate_limit(p_key text, p_max int, p_window_secs int)
returns boolean language plpgsql set search_path = public as $$
declare r public.rate_limits;
begin
  insert into public.rate_limits(key, window_start, count) values (p_key, now(), 0)
  on conflict (key) do nothing;
  select * into r from public.rate_limits where key = p_key for update;
  if r.window_start < now() - make_interval(secs => p_window_secs) then
    update public.rate_limits set window_start = now(), count = 1 where key = p_key;
    return true;
  end if;
  if r.count >= p_max then return false; end if;
  update public.rate_limits set count = count + 1 where key = p_key;
  return true;
end $$;

create or replace function public.create_admin_session() returns text
language plpgsql set search_path = public, extensions as $$
declare v_token text := encode(gen_random_bytes(24), 'hex');
begin
  insert into sessions(token, is_admin, expires_at) values (v_token, true, now() + interval '8 hours');
  return v_token;
end $$;

create or replace function public.current_period_info() returns json language sql stable set search_path = public as $$
  with t as (select public.ist_now() as n)
  select json_build_object(
    'now', to_char((select n from t), 'YYYY-MM-DD"T"HH24:MI:SS'),
    'today', to_char((select n from t)::date, 'YYYY-MM-DD'),
    'weekday', extract(isodow from (select n from t))::int,
    'current', (select row_to_json(p) from public.periods p, t
                where p.start_time <= t.n::time and p.end_time > t.n::time order by p.sort_order limit 1),
    'next', (select row_to_json(p) from public.periods p, t
             where p.start_time > t.n::time and not p.is_break order by p.start_time limit 1),
    'bookable', (select coalesce(json_agg(row_to_json(p) order by p.start_time), '[]'::json)
                 from public.periods p, t where p.end_time > t.n::time and not p.is_break)
  )
$$;

create or replace function public.get_availability(p_period_id int, p_date date)
returns json language sql stable set search_path = public as $$
  select coalesce(json_agg(x order by x.name), '[]'::json) from (
    select r.id, r.name, r.type, r.location_note, r.is_active,
      (select count(*) from public.seats s where s.room_id = r.id and s.is_active)::int as total,
      (select count(*) from public.bookings b where b.room_id = r.id and b.period_id = p_period_id
         and b.date = p_date and b.status = 'active')::int as booked,
      (select rb.reason from public.room_blocks rb where rb.room_id = r.id and rb.period_id = p_period_id
         and rb.weekday = extract(isodow from p_date)::int limit 1) as block_reason
    from public.rooms r
  ) x
$$;

create or replace function public.get_room_seats(p_room_id int, p_period_id int, p_date date)
returns json language sql stable set search_path = public as $$
  select json_build_object(
    'room', (select row_to_json(r) from public.rooms r where r.id = p_room_id),
    'block_reason', (select rb.reason from public.room_blocks rb where rb.room_id = p_room_id
         and rb.period_id = p_period_id and rb.weekday = extract(isodow from p_date)::int limit 1),
    'seats', (select coalesce(json_agg(json_build_object('id', s.id, 'label', s.label, 'is_active', s.is_active,
        'taken', exists(select 1 from public.bookings b where b.seat_id = s.id and b.period_id = p_period_id
          and b.date = p_date and b.status = 'active')) order by s.id), '[]'::json)
      from public.seats s where s.room_id = p_room_id)
  )
$$;

create or replace function public.book_seat(p_student_id int, p_room_id int, p_seat_id int, p_period_id int)
returns json language plpgsql set search_path = public as $$
declare v_now timestamp := public.ist_now(); p public.periods; r public.rooms; s public.seats; b public.bookings; c text;
begin
  perform public.expire_bookings();
  select * into p from public.periods where id = p_period_id;
  if not found or p.is_break then raise exception 'INVALID_PERIOD'; end if;
  if p.end_time <= v_now::time then raise exception 'PERIOD_PAST'; end if;
  select * into r from public.rooms where id = p_room_id;
  if not found or not r.is_active then raise exception 'ROOM_UNAVAILABLE'; end if;
  if exists (select 1 from public.room_blocks where room_id = p_room_id and period_id = p_period_id
             and weekday = extract(isodow from v_now)::int) then raise exception 'ROOM_BLOCKED'; end if;
  select * into s from public.seats where id = p_seat_id and room_id = p_room_id;
  if not found or not s.is_active then raise exception 'INVALID_SEAT'; end if;
  begin
    insert into public.bookings(student_id, room_id, seat_id, period_id, date)
    values (p_student_id, p_room_id, p_seat_id, p_period_id, v_now::date) returning * into b;
  exception when unique_violation then
    get stacked diagnostics c = constraint_name;
    if c = 'bookings_student_active_uniq' then raise exception 'ALREADY_BOOKED'; end if;
    raise exception 'SEAT_TAKEN';
  end;
  return row_to_json(b);
end $$;

create or replace function public.cancel_booking(p_booking_id int, p_student_id int)
returns json language plpgsql set search_path = public as $$
declare b public.bookings;
begin
  update public.bookings set status = 'cancelled', cancelled_at = now()
  where id = p_booking_id and status = 'active' and (p_student_id is null or student_id = p_student_id)
  returning * into b;
  if not found then raise exception 'NOT_FOUND'; end if;
  return row_to_json(b);
end $$;

create or replace function public.set_room_seats(p_room_id int, p_count int) returns void
language plpgsql set search_path = public as $$
declare i int; v_label text;
begin
  if p_count < 0 or p_count > 200 then raise exception 'INVALID_SEAT_COUNT'; end if;
  update public.seats set is_active = false where room_id = p_room_id;
  for i in 1..p_count loop
    v_label := chr(65 + (i - 1) / 4) || (((i - 1) % 4) + 1)::text;
    insert into public.seats(room_id, label, is_active) values (p_room_id, v_label, true)
    on conflict (room_id, label) do update set is_active = true;
  end loop;
  update public.rooms set total_seats = p_count where id = p_room_id;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to service_role;

insert into public.periods(name, start_time, end_time, is_break, sort_order) values
 ('1st','08:00','08:40',false,1),('2nd','08:40','09:20',false,2),('3rd','09:20','10:00',false,3),
 ('4th','10:00','10:40',false,4),('Lunch','10:40','11:20',true,5),('5th','11:20','12:00',false,6),
 ('6th','12:00','12:40',false,7),('7th','12:40','13:20',false,8),('8th','13:20','14:00',false,9);

insert into public.rooms(name, type, location_note) values
 ('Room 101','classroom','Ground floor, next to the Library'),
 ('Room 102','classroom','Ground floor, end of the east corridor'),
 ('Room 103','classroom','First floor, above the staff room'),
 ('Library','library','Ground floor, main building');
select public.set_room_seats(1,12), public.set_room_seats(2,12), public.set_room_seats(3,20), public.set_room_seats(4,25);

insert into public.room_blocks(room_id, period_id, weekday, reason)
select 3, p.id, d, 'Class 10B Physics' from public.periods p, generate_series(1,6) d where p.sort_order = 2
union all
select 3, p.id, d, 'Class 9A Maths' from public.periods p, generate_series(1,6) d where p.sort_order = 7
union all
select 1, p.id, 3, 'Class 11 Chemistry practical' from public.periods p where p.sort_order = 3;

create or replace function public.handle_new_student() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_roll text := upper(trim(coalesce(new.raw_user_meta_data->>'roll_no','')));
begin
  if v_roll !~ '^(11|12)[A-Z]_\d{1,2}$' then raise exception 'INVALID_ROLL'; end if;
  insert into public.students(roll_no, name, class_label, user_id, email)
  values (v_roll,
          left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''), v_roll), 80),
          substr(v_roll, 1, 3), new.id, lower(new.email));
  return new;
end $$;
revoke execute on function public.handle_new_student() from public, anon, authenticated;
create trigger on_auth_user_created_student after insert on auth.users
  for each row execute function public.handle_new_student();