-- This project does not grant new tables to the API roles automatically.
-- The server (secret key = service_role) reads orders for the order-status page and the PAYable webhook.
-- Writes still go only through create_order / start_payment_attempt / record_payment_result.
grant select on public.orders, public.order_items, public.payment_attempts to service_role;
