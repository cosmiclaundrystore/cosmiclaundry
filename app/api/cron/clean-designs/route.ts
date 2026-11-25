import { adminSupabase, restGet, rpc, storageDelete, storageList } from '@/lib/supabase/rest';
import { DESIGN_BUCKET } from '@/lib/custom/designs';

// Daily clean-up: custom tee designs, and rewards held by unpaid orders.
// Custom tee designs (Vercel Cron, see vercel.json), so Storage stays small on the free plan:
// - uploads that never became an order: after 24 hours
// - designs on unpaid or failed orders: after 7 days
// - designs on delivered, cancelled or refunded orders: 30 days after the order last changed
// Paid orders that haven't been delivered keep their design.
export const dynamic = 'force-dynamic';

const HOUR = 3600_000;
const DAY = 24 * HOUR;

type Line = { design_path: string; orders: { status: string; fulfillment_status: string; created_at: string; updated_at: string } | null };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  const target = adminSupabase();
  if (!target) return new Response('Supabase is not configured', { status: 500 });

  const [files, lines] = await Promise.all([
    storageList(target, DESIGN_BUCKET, 'pending'),
    restGet<Line>(target, 'order_items?select=design_path,orders(status,fulfillment_status,created_at,updated_at)&design_path=not.is.null&limit=10000'),
  ]);
  const used = new Map(lines.map((l) => [l.design_path, l.orders]));
  const now = Date.now();
  const remove: string[] = [];

  for (const file of files) {
    if (!file.name || !file.created_at) continue;
    const path = `pending/${file.name}`;
    const order = used.get(path);
    const age = now - new Date(file.created_at).getTime();
    if (!order) {
      if (age > DAY) remove.push(path);
      continue;
    }
    const sinceChange = now - new Date(order.updated_at).getTime();
    const sinceOrder = now - new Date(order.created_at).getTime();
    if ((order.status === 'pending' || order.status === 'failed') && sinceOrder > 7 * DAY) remove.push(path);
    else if ((order.status === 'cancelled' || order.status === 'refunded') && sinceChange > 30 * DAY) remove.push(path);
    else if (order.fulfillment_status === 'delivered' && sinceChange > 30 * DAY) remove.push(path);
  }

  for (let i = 0; i < remove.length; i += 100) await storageDelete(target, DESIGN_BUCKET, remove.slice(i, i + 100));
  // Unpaid orders that have held a customer's reward for over 24 hours are cancelled, so the reward comes back.
  const rewardsReleased = await rpc<number>(target, 'release_stale_rewards', {});
  return Response.json({ checked: files.length, deleted: remove.length, rewardsReleased });
}
