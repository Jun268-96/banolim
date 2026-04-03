-- Push notification subscriptions
create table public.push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    member_id uuid not null references public.members(id) on delete cascade,
    endpoint text not null,
    p256dh text not null,
    auth text not null,
    created_at timestamptz default now(),
    unique (member_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

-- 본인 구독만 조회/등록/삭제 가능
create policy "own_subscription_select" on public.push_subscriptions
    for select using (
        member_id = (select id from public.members where auth_user_id = auth.uid() limit 1)
    );

create policy "own_subscription_insert" on public.push_subscriptions
    for insert with check (
        member_id = (select id from public.members where auth_user_id = auth.uid() limit 1)
    );

create policy "own_subscription_delete" on public.push_subscriptions
    for delete using (
        member_id = (select id from public.members where auth_user_id = auth.uid() limit 1)
    );
