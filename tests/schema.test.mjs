import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('Schema: instalación, RLS, puntuaciones, transacciones y permisos de Storage', async () => {
  const pg = new PGlite();
  try {
    // Stand-ins for Supabase-owned objects; the application SQL runs unchanged.
    await pg.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public, auth, storage to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
    `);
    const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
    await pg.exec(schema);
    await pg.exec(schema); // Reapplying must preserve existing rows/policies.
    const admin = '00000000-0000-4000-8000-000000000001';
    const judge = '00000000-0000-4000-8000-000000000002';
    const moderator = '00000000-0000-4000-8000-000000000003';
    const stranger = '00000000-0000-4000-8000-000000000004';
    await pg.exec(`
      insert into auth.users values ('${admin}'),('${judge}'),('${moderator}'),('${stranger}');
      insert into public.profiles(id,role,subject_id,display_name,identifier) values
        ('${admin}','admin',null,'Admin','admin@example.com'),
        ('${judge}','judge','judge-1','Jurado Uno','123'),
        ('${moderator}','moderator','mod-1','Moderador','moderador');
      insert into public.judges(id,data) values ('judge-1','{"name":"Jurado Uno","cedula":"123","token":"private-token","status":"active"}');
      insert into public.moderators(id,data) values ('mod-1','{"username":"moderador","token":"private-token","status":"active"}');
    `);
    async function as(role, id = '') {
      await pg.exec('reset role');
      await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await pg.exec(`set role ${role}`);
    }
    const write = operations => pg.query('select public.write_documents($1::jsonb)', [JSON.stringify(operations)]);
    const count = async table => Number((await pg.query(`select count(*) as n from public.${table}`)).rows[0].n);
    await as('authenticated', admin);
    await write([
      { table: 'schools', id: 'school-1', operation: 'insert', data: { schoolName: 'Colegio', contactEmail: 'privado@example.com' } },
      { table: 'rounds', id: 'round-1', operation: 'insert', data: { name: 'Grupo A', phase: 'Fase de Grupos' } },
      { table: 'rubric', id: 'criterion-1', operation: 'insert', data: { name: 'Claridad' } },
      { table: 'debate_state', id: 'current', operation: 'merge', data: { currentRound: 'Grupo A', teams: [{ name: 'A' }, { name: 'B' }], isQrEnabled: true, questionId: 'q1' } },
      { table: 'questions', id: 'q1', operation: 'insert', data: { text: 'Pregunta activa' } },
      { table: 'questions', id: 'q2', operation: 'insert', data: { text: 'Pregunta privada' } },
    ]);
    await as('anon');
    assert.equal(await count('debate_state'), 1);
    await assert.rejects(count('schools'), /permission denied/);
    await assert.rejects(count('judges'), /permission denied/);
    assert.equal(await count('questions'), 1);
    await assert.rejects(write([{ table: 'debate_state', id: 'current', operation: 'merge', data: { currentRound: 'FORGED' } }]), /permission denied/);
    await assert.rejects(write([{ table: 'profiles', id: stranger, operation: 'insert', data: { role: 'admin' } }]), /Tabla no válida/);
    await write([{ table: 'student_questions', id: 'sq1', operation: 'insert', data: { name: 'Estudiante', text: 'Pregunta', relatedDebateQuestionId: 'q1', targetTeam: 'A', status: 'pending' } }]);
    await assert.rejects(write([{ table: 'student_questions', id: 'sq2', operation: 'insert', data: { name: 'Estudiante', text: 'Pregunta', relatedDebateQuestionId: 'q2', targetTeam: 'A', status: 'pending' } }]), /row-level security/);
    await assert.rejects(write([{ table: 'survey_responses', id: 'sr1', operation: 'insert', data: { answers: { q: '5' }, isAdminSubmission: false } }]), /row-level security/);
    await as('authenticated', stranger);
    assert.equal(await count('judges'), 0);
    await assert.rejects(pg.exec(`insert into profiles(id,role,display_name) values ('${stranger}','admin','Hacker')`), /permission denied/);
    await as('authenticated', judge);
    const validScore = { matchId: 'Grupo A', judgeId: 'judge-1', judgeName: 'FORGED', judgeCedula: 'private', teams: [], fullScores: [
      { name: 'A', scores: { 'criterion-1': 4 }, total: 999 }, { name: 'B', scores: { 'criterion-1': 3 }, total: 999 },
    ] };
    await assert.rejects(write([{ table: 'scores', id: 'invalid', operation: 'insert', data: { ...validScore, matchId: 'Otra ronda' } }]), /ronda activa/);
    await write([{ table: 'scores', id: 'score-1', operation: 'insert', data: validScore }]);
    const saved = (await pg.query('select data from scores')).rows[0].data;
    assert.equal(saved.teams[0].total, 4);
    assert.equal(saved.judgeName, 'Jurado Uno');
    assert.equal(saved.judgeCedula, undefined);
    await assert.rejects(write([{ table: 'scores', id: 'duplicate', operation: 'insert', data: validScore }]), /unique constraint/);
    await as('anon');
    assert.equal(await count('scores'), 0);
    await as('authenticated', admin);
    await write([{ table: 'settings', id: 'competition', operation: 'merge', data: { groupStageResultsPublished: true } }]);
    await as('anon');
    assert.equal(await count('scores'), 1);
    await as('authenticated', admin);
    await write([{ table: 'settings', id: 'competition', operation: 'merge', data: { groupStageResultsPublished: false } }]);
    await write([{ table: 'judges', id: 'judge-1', operation: 'update', data: { status: 'inactive' } }]);
    await as('authenticated', judge);
    assert.equal((await pg.query('select current_profile() as p')).rows[0].p, null);
    assert.equal(await count('scores'), 0);
    await assert.rejects(write([{ table: 'scores', id: 'revoked', operation: 'insert', data: validScore }]), /row-level security/);
    await as('authenticated', moderator);
    await write([{ table: 'debate_state', id: 'current', operation: 'merge', data: { timer: { duration: 180 } } }]);
    const timer = (await pg.query("select data->'timer' as timer from debate_state where id='current'")).rows[0].timer;
    assert.equal(timer.duration, 180);
    assert.equal(timer.isActive, false);
    await pg.exec("insert into storage.objects(bucket_id,name) values ('debate-media','videos/test.mp4')");
    await assert.rejects(write([
      { table: 'questions', id: 'rollback', operation: 'insert', data: { text: 'No debe persistir' } },
      { table: 'settings', id: 'competition', operation: 'merge', data: { registrationsClosed: true } },
    ]), /row-level security/);
    assert.equal((await pg.query("select id from questions where id='rollback'")).rows.length, 0);
    await as('anon');
    await assert.rejects(pg.exec("insert into storage.objects(bucket_id,name) values ('debate-media','videos/forged.mp4')"), /row-level security/);
    await as('authenticated', admin);
    await write([{ table: 'site_content', id: 'survey', operation: 'merge', data: { isActive: true } }]);
    await as('anon');
    await write([{ table: 'survey_responses', id: 'sr2', operation: 'insert', data: { answers: { q: '5' }, isAdminSubmission: false } }]);
    await assert.rejects(count('survey_responses'), /permission denied/);
    await as('authenticated', admin);
    await write([{ table: 'scores', id: 'score-1', operation: 'delete' }]);
    assert.equal(await count('scores'), 0);
  } finally { await pg.close(); }
});
