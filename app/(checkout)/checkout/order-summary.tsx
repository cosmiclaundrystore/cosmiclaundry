import { formatMoney, type Currency } from '@/lib/checkout/shared';

export type SummaryLine = { key: string; name: string; detail: string; quantity: number; lineMinor: number; image?: string };

export function OrderSummary(props: {
  lines: SummaryLine[];
  currency: Currency;
  subtotalMinor: number;
  shippingMinor: number;
  shippingLabel: string;
  /** Reward: 20% off the tees + free delivery. */
  discountMinor?: number;
  totalMinor: number;
  heading?: string;
}) {
  const { lines, currency } = props;
  const pieces = lines.reduce((sum, line) => sum + line.quantity, 0);
  // The reward is 20% off the tees plus the delivery fee, so show both cuts and the old total struck through.
  const discount = props.discountMinor ?? 0;
  const teeDiscount = Math.max(0, discount - props.shippingMinor);
  const fullTotal = props.subtotalMinor + props.shippingMinor;
  return (
    <section className="co-summary" aria-labelledby="co-summary-title">
      <h2 id="co-summary-title" className="co-summary-title">
        {props.heading ?? 'Your laundry'} <span>{pieces} {pieces === 1 ? 'piece' : 'pieces'}</span>
      </h2>
      <ul className="co-lines">
        {lines.map((line) => (
          <li key={line.key} className="co-line">
            {line.image ? (
              <span className="co-line-art">
                <img src={line.image} alt="" width={96} height={120} loading="lazy" decoding="async" />
                <span className="co-line-qty" aria-label={`Quantity ${line.quantity}`}>{line.quantity}</span>
              </span>
            ) : null}
            <span className="co-line-text">
              <strong>{line.name}</strong>
              <span>{line.detail}{line.image ? '' : ` · Qty ${line.quantity}`}</span>
            </span>
            <span className="co-line-price">{formatMoney(line.lineMinor, currency)}</span>
          </li>
        ))}
      </ul>
      {discount > 0 ? (
        <dl className="co-totals co-totals-reward">
          <div>
            <dt>Subtotal <span className="co-off-badge">20% off</span></dt>
            <dd><s>{formatMoney(props.subtotalMinor, currency)}</s> {formatMoney(props.subtotalMinor - teeDiscount, currency)}</dd>
          </div>
          <div>
            <dt>{props.shippingLabel}</dt>
            <dd>{props.shippingMinor > 0 ? <s>{formatMoney(props.shippingMinor, currency)}</s> : null} <strong className="co-free">Free</strong></dd>
          </div>
          <div className="co-discount"><dt>Reward savings</dt><dd>−{formatMoney(discount, currency)}</dd></div>
          <div className="co-total">
            <dt>Total</dt>
            <dd><s className="co-was">{formatMoney(fullTotal, currency)}</s> <small>{currency}</small> {formatMoney(props.totalMinor, currency)}</dd>
          </div>
        </dl>
      ) : (
        <dl className="co-totals">
          <div><dt>Subtotal</dt><dd>{formatMoney(props.subtotalMinor, currency)}</dd></div>
          <div><dt>{props.shippingLabel}</dt><dd>{formatMoney(props.shippingMinor, currency)}</dd></div>
          <div className="co-total"><dt>Total</dt><dd><small>{currency}</small> {formatMoney(props.totalMinor, currency)}</dd></div>
        </dl>
      )}
    </section>
  );
}
