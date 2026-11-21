import { randomBytes } from 'node:crypto';
import { webhookCheckValue } from '@/lib/payable/check-value';
import { MOCK_CREDENTIALS } from '@/lib/payable/config';
import { mockEnabled, mockNotFound, mockState, type MockSession } from '@/lib/payable/mock';

// Fake PAYable hosted payment page (PAYABLE_MODE=mock only). Pick an outcome; it sends the webhook
// the way PAYable does (server to server, signed), then sends the customer back to returnUrl.

type Params = { params: Promise<{ session: string }> };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function GET(_request: Request, { params }: Params) {
  if (!mockEnabled()) return mockNotFound();
  const session = mockState().sessions.get((await params).session);
  if (!session) return new Response('This payment session has expired.', { status: 404 });
  const b = session.body;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mock PAYable checkout</title>
<style>body{margin:0;font:15px/1.5 system-ui,sans-serif;background:#eef1f5;color:#1b2430}main{max-width:440px;margin:40px auto;padding:28px;background:#fff;border-radius:10px;box-shadow:0 8px 30px #0001}
.tag{display:inline-block;padding:3px 8px;border-radius:4px;background:#fff3c4;color:#6b5300;font-size:12px;font-weight:600}h1{font-size:20px;margin:14px 0 4px}.amount{font-size:30px;font-weight:700;margin:12px 0}
dl{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:13px;color:#4b5563}dt{color:#8a94a3}button{display:block;width:100%;margin-top:10px;padding:13px;border:0;border-radius:6px;font:inherit;font-weight:600;cursor:pointer}
.ok{background:#1f7a4d;color:#fff}.no{background:#b3261e;color:#fff}.alt{background:#e3e8ef;color:#1b2430}small{display:block;margin-top:16px;color:#8a94a3;font-size:12px}</style></head>
<body><main><span class="tag">MOCK PAYABLE · TEST ONLY</span><h1>${esc(b.orderDescription)}</h1>
<div class="amount">${esc(b.currencyCode)} ${esc(b.amount)}</div>
<dl><dt>Invoice</dt><dd>${esc(b.invoiceId)}</dd><dt>Customer</dt><dd>${esc(b.customerFirstName)} ${esc(b.customerLastName)}</dd><dt>Email</dt><dd>${esc(b.customerEmail)}</dd><dt>Mobile</dt><dd>${esc(b.customerMobilePhone)}</dd></dl>
<form method="post">
<button class="ok" name="outcome" value="approve">Approve payment</button>
<button class="no" name="outcome" value="decline">Decline payment</button>
<button class="alt" name="outcome" value="approve_twice">Approve, send the webhook twice</button>
<button class="alt" name="outcome" value="approve_no_webhook">Approve, but lose the webhook</button>
<button class="alt" name="outcome" value="cancel">Cancel and go back</button>
</form><small>This page stands in for PAYable's hosted checkout while the real sandbox keys are pending. No card is charged.</small></main></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

async function sendWebhook(session: MockSession, success: boolean) {
  const b = session.body;
  const fields = {
    merchantKey: b.merchantKey,
    payableOrderId: session.payableOrderId,
    payableTransactionId: `TX${randomBytes(5).toString('hex').toUpperCase()}`,
    payableAmount: b.amount,
    payableCurrency: b.currencyCode,
    invoiceNo: b.invoiceId,
    statusCode: success ? '1' : '2',
  };
  const payload = {
    ...fields,
    statusCode: Number(fields.statusCode),
    statusMessage: success ? 'SUCCESS' : 'FAILURE',
    paymentType: 1,
    paymentMethod: 'VISA',
    paymentScheme: 'VISA',
    custom1: '',
    custom2: '',
    cardHolderName: `${b.customerFirstName} ${b.customerLastName}`,
    cardNumber: '************1019',
    checkValue: webhookCheckValue(fields, MOCK_CREDENTIALS.merchantToken),
  };
  const response = await fetch(b.webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), cache: 'no-store' });
  console.info(`[mock-payable] webhook ${fields.invoiceNo} status ${fields.statusCode} -> ${response.status} ${await response.text()}`);
}

export async function POST(request: Request, { params }: Params) {
  if (!mockEnabled()) return mockNotFound();
  const state = mockState();
  const id = (await params).session;
  const session = state.sessions.get(id);
  if (!session) return new Response('This payment session has expired.', { status: 404 });
  const outcome = String((await request.formData()).get('outcome') ?? '');
  state.sessions.delete(id);

  if (outcome === 'cancel') return Response.redirect(session.body.cancelUrl || session.body.returnUrl, 303);
  if (outcome === 'approve' || outcome === 'decline' || outcome === 'approve_twice') {
    await sendWebhook(session, outcome !== 'decline');
    if (outcome === 'approve_twice') await sendWebhook(session, true);
  }
  // PAYable passes no payment status on returnUrl; the shop reads it from its own database.
  return Response.redirect(session.body.returnUrl, 303);
}
