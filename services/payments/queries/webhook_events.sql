-- name: InsertWebhookEvent :execrows
insert into payments.webhook_events (provider, external_event_id, payload)
values ($1, $2, $3)
on conflict (provider, external_event_id) do nothing;
