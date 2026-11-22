// Only used with disposable databases. Build the saved plan through its normal RPC.
export async function seedTrend(sql, location) {
  const [{ id: source }] = await sql(
    "insert into tap_placards(location_id,placement) values($1,'Front desk') returning id",
    [location],
  )
  async function visits(daysAgo, count, matching, { rating = 3, preview = false } = {}) {
    await sql(
      `insert into tap_feedback(id,location_id,placard_id,rating,is_test,comment,themes,analysis_status,created_at)
      select gen_random_uuid(),$1,$2,$3,$4,case when i<=$5 then 'Rude interaction' else '' end,
      case when i<=$5 then '[{"name":"Staff behavior","excerpt":"Rude interaction"}]'::jsonb else '[]'::jsonb end,
      'ready', now()-$6*interval '1 day' from generate_series(1,$7::int) i`,
      [location, source, rating, preview, matching, daysAgo, count],
    )
  }
  await visits(21, 5, 3)
  const [{ id }] = await sql(
    "select tap_create_issue($1,current_date-24,current_date-18,$2,3,false,'staff-conduct') id",
    [location, source],
  )
  const [{ task }] = await sql(
    `update issue_playbooks set created_at=now()-interval '16 days',
    snapshot=jsonb_set(snapshot,'{captured}',to_jsonb(now()-interval '16 days')),owner_context='Discussed the interaction with the team.'
    where id=$1 returning state->>'task' task`,
    [id],
  )
  await visits(12, 3, 3)
  await sql(
    "update playbook_tasks set status='done',completed_at=now()-interval '8 days' where id=$1",
    [task],
  )
  await visits(2, 6, 1)
  await visits(2, 2, 2, { preview: true })
  await visits(2, 1, 1, { rating: 4 })
  return { id, source, task, visits }
}
