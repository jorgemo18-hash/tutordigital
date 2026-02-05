-- Cleanup rejected students older than 30 days
create extension if not exists pg_cron;

create or replace function cleanup_rejected_students()
returns void as $$
begin
  delete from students
  where approval_status = 'rejected'
    and rejected_at is not null
    and rejected_at < now() - interval '30 days';
end;
$$ language plpgsql;

select cron.schedule(
  'cleanup_rejected_students_daily',
  '0 3 * * *',
  $$select cleanup_rejected_students();$$
);
