create or replace function public.audit_member_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_changes jsonb := '{}'::jsonb;
    v_summary text;
    v_previous_role_name text;
    v_next_role_name text;
    v_previous_team_name text;
    v_next_team_name text;
begin
    if tg_op = 'INSERT' then
        select roles.name
        into v_next_role_name
        from public.roles
        where roles.id = new.role_id
        limit 1;

        select teams.name
        into v_next_team_name
        from public.teams
        where teams.id = new.team_id
        limit 1;

        perform public.create_audit_log(
            'member',
            new.id,
            'created',
            jsonb_build_object(
                'summary', concat(new.name, ' 멤버 등록'),
                'memberName', new.name,
                'changes', jsonb_build_object(
                    'loginEmail', jsonb_build_object('to', new.login_email),
                    'role', jsonb_build_object(
                        'toId', new.role_id,
                        'toName', v_next_role_name,
                        'toScope', public.member_role_scope(new.role_id)
                    ),
                    'team', jsonb_build_object(
                        'toId', new.team_id,
                        'toName', v_next_team_name
                    ),
                    'status', jsonb_build_object('to', new.status),
                    'approval', jsonb_build_object('to', new.is_approved),
                    'visibility', jsonb_build_object('to', new.is_visible)
                )
            )
        );

        return new;
    end if;

    select roles.name
    into v_previous_role_name
    from public.roles
    where roles.id = old.role_id
    limit 1;

    select roles.name
    into v_next_role_name
    from public.roles
    where roles.id = new.role_id
    limit 1;

    select teams.name
    into v_previous_team_name
    from public.teams
    where teams.id = old.team_id
    limit 1;

    select teams.name
    into v_next_team_name
    from public.teams
    where teams.id = new.team_id
    limit 1;

    if old.name is distinct from new.name then
        v_changes := v_changes || jsonb_build_object(
            'name',
            jsonb_build_object('from', old.name, 'to', new.name)
        );
    end if;

    if old.login_email is distinct from new.login_email then
        v_changes := v_changes || jsonb_build_object(
            'loginEmail',
            jsonb_build_object('from', old.login_email, 'to', new.login_email)
        );
    end if;

    if old.role_id is distinct from new.role_id then
        v_changes := v_changes || jsonb_build_object(
            'role',
            jsonb_build_object(
                'fromId', old.role_id,
                'fromName', v_previous_role_name,
                'fromScope', public.member_role_scope(old.role_id),
                'toId', new.role_id,
                'toName', v_next_role_name,
                'toScope', public.member_role_scope(new.role_id)
            )
        );
    end if;

    if old.team_id is distinct from new.team_id then
        v_changes := v_changes || jsonb_build_object(
            'team',
            jsonb_build_object(
                'fromId', old.team_id,
                'fromName', v_previous_team_name,
                'toId', new.team_id,
                'toName', v_next_team_name
            )
        );
    end if;

    if old.status is distinct from new.status then
        v_changes := v_changes || jsonb_build_object(
            'status',
            jsonb_build_object('from', old.status, 'to', new.status)
        );
    end if;

    if old.is_approved is distinct from new.is_approved then
        v_changes := v_changes || jsonb_build_object(
            'approval',
            jsonb_build_object('from', old.is_approved, 'to', new.is_approved)
        );
    end if;

    if old.is_visible is distinct from new.is_visible then
        v_changes := v_changes || jsonb_build_object(
            'visibility',
            jsonb_build_object('from', old.is_visible, 'to', new.is_visible)
        );
    end if;

    if v_changes = '{}'::jsonb then
        return new;
    end if;

    v_summary := case
        when v_changes ? 'role' then concat(new.name, ' · 직책/권한 변경')
        when v_changes ? 'loginEmail' then concat(new.name, ' · 로그인 이메일 변경')
        when v_changes ? 'approval' then concat(new.name, ' · 승인 상태 변경')
        when v_changes ? 'status' then concat(new.name, ' · 회원 상태 변경')
        when v_changes ? 'team' then concat(new.name, ' · 소속 팀 변경')
        else concat(new.name, ' · 회원 정보 수정')
    end;

    perform public.create_audit_log(
        'member',
        new.id,
        'updated',
        jsonb_build_object(
            'summary', v_summary,
            'memberName', new.name,
            'changes', v_changes
        )
    );

    return new;
end;
$$;

drop trigger if exists trg_members_audit on public.members;
create trigger trg_members_audit
after insert or update on public.members
for each row
execute function public.audit_member_changes();
