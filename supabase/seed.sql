insert into public.roles (name, permission_scope, rank_order)
values
    ('회장', 'super_admin', 10),
    ('부회장', 'operator', 20),
    ('기획팀장', 'operator', 30),
    ('홍보팀장&총무', 'operator', 40),
    ('운영팀장', 'operator', 50),
    ('스터디장', 'team_lead', 60),
    ('일반회원', 'member', 100)
on conflict (name) do nothing;

insert into public.teams (name, type)
values
    ('임원진', 'core'),
    ('기획팀', 'core'),
    ('홍보팀', 'core'),
    ('운영팀', 'core'),
    ('스터디', 'study')
on conflict (name) do nothing;

insert into public.seasons (name, start_date, end_date, status)
values
    ('2026 상반기', '2026-03-01', '2026-08-31', 'active')
on conflict (name) do nothing;

insert into public.activity_types (code, name, group_name)
values
    ('attendance-present', '정기모임 출석', 'attendance'),
    ('study-participation', '스터디 참여', 'study'),
    ('presentation', '발표', 'contribution'),
    ('late-arrival', '지각', 'attendance')
on conflict (code) do nothing;

insert into public.point_rules (activity_type_id, base_point, penalty_point, condition_json, is_active, version)
select id, points, 0, '{}'::jsonb, true, 1
from (
    values
        ('attendance-present', 10),
        ('study-participation', 15),
        ('presentation', 30),
        ('late-arrival', -5)
) as seed(code, points)
join public.activity_types on activity_types.code = seed.code
where not exists (
    select 1
    from public.point_rules pr
    where pr.activity_type_id = activity_types.id
      and pr.version = 1
);

insert into public.members (name, role_id, team_id, status, is_visible, is_approved)
select
    seed.name,
    roles.id,
    teams.id,
    'active',
    true,
    true
from (
    values
        ('이동섭', '회장', '임원진'),
        ('김주영', '부회장', '임원진'),
        ('김세현', '기획팀장', '기획팀'),
        ('이민희', '홍보팀장&총무', '홍보팀'),
        ('김소현', '운영팀장', '운영팀'),
        ('양윤환', '스터디장', '스터디'),
        ('고상균', '일반회원', null),
        ('이기원', '일반회원', null),
        ('김민준', '일반회원', null),
        ('김예지', '일반회원', null),
        ('김유승', '일반회원', null),
        ('김형준', '일반회원', null),
        ('이민경', '일반회원', null),
        ('박미림', '일반회원', null),
        ('박세현', '일반회원', null),
        ('박종한', '일반회원', null),
        ('송채영', '일반회원', null),
        ('안세은', '일반회원', null),
        ('안소연', '일반회원', null),
        ('양연조', '일반회원', null),
        ('유태민', '일반회원', null),
        ('윤라현', '일반회원', null),
        ('이두람', '일반회원', null),
        ('이민지', '일반회원', null),
        ('이병철', '일반회원', null),
        ('이수진', '일반회원', null),
        ('이예지', '일반회원', null),
        ('이은주', '일반회원', null),
        ('이채헌', '일반회원', null),
        ('이하연', '일반회원', null),
        ('이현정', '일반회원', null),
        ('임은영', '일반회원', null),
        ('전원정', '일반회원', null),
        ('이정민', '일반회원', null),
        ('한정기', '일반회원', null),
        ('황성준', '일반회원', null),
        ('황현준', '일반회원', null)
) as seed(name, role_name, team_name)
join public.roles on roles.name = seed.role_name
left join public.teams on teams.name = seed.team_name
where not exists (
    select 1
    from public.members m
    where m.name = seed.name
);
