import { formatMoney, type Currency } from '@/lib/checkout/shared';

export type SummaryLine = { key: string; name: string; detail: string; quantity: number; lineMinor: number; image?: string };

export function OrderSummary(props: {
  lines: SummaryLine[];
  currency: Currency;
  subtotalMinor: number;
  shippingMinor: number;
  shippingLabel: string;
  totalMinor: number;
  heading?: string;
}) {
  const { lines, currency } = props;
  const pieces = lines.reduce((sum, line) => sum + line.quantity, 0);
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
      <dl className="co-totals">
        <div><dt>Subtotal</dt><dd>{formatMoney(props.subtotalMinor, currency)}</dd></div>
        <div><dt>{props.shippingLabel}</dt><dd>{formatMoney(props.shippingMinor, currency)}</dd></div>
        <div className="co-total"><dt>Total</dt><dd><small>{currency}</small> {formatMoney(props.totalMinor, currency)}</dd></div>
      </dl>
    </section>
  );
}
