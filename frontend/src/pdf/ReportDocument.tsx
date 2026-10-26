// The PDF layout. Built for A4 print and reading, not a capture of the dashboard.
// Sections flow naturally across pages: small blocks never split (wrap={false}) and headings keep at least a few
// lines of content with them (minPresenceAhead), so nothing is stranded at the foot of a page.
import React from 'react';
import { Document, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { COLORS, FONT, PdfTone, TONES } from './theme';
import { PdfReportModel, Row } from './reportModel';

const s = StyleSheet.create({
  page: { fontFamily: FONT, fontSize: 9, color: COLORS.soft, paddingTop: 52, paddingBottom: 54, paddingHorizontal: 40, lineHeight: 1.45 },
  // absolute offsets are measured from the page edge (A4 = 595 x 842pt)
  runningHeaderBox: { position: 'absolute', top: 22, left: 40, right: 40 },
  runningHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  runningHeaderText: { fontSize: 7.5, color: COLORS.muted },
  footerBox: { position: 'absolute', top: 842 - 34, left: 40, right: 40 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: COLORS.line, paddingTop: 6 },
  footerText: { fontSize: 7.5, color: COLORS.muted },

  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  brand: { fontSize: 13, fontWeight: 700, color: COLORS.ink },
  brandSub: { fontSize: 8, color: COLORS.muted, marginTop: 1 },
  accentRule: { height: 2, backgroundColor: COLORS.accent, width: 36, marginBottom: 12 },
  title: { fontSize: 21, fontWeight: 700, color: COLORS.ink, lineHeight: 1.2 },
  identity: { fontSize: 9.5, color: COLORS.muted, marginTop: 4 },

  hero: { flexDirection: 'row', marginTop: 14, marginBottom: 12 },
  priceBlock: { flex: 1, paddingRight: 16, justifyContent: 'center' },
  label: { fontSize: 8, color: COLORS.muted },
  price: { fontSize: 27, fontWeight: 700, color: COLORS.ink, lineHeight: 1.15 },
  priceCurrency: { fontSize: 8.5, color: COLORS.muted, marginTop: 1 },
  recBox: { width: 190, borderWidth: 1, borderRadius: 6, padding: 12 },
  recText: { fontSize: 22, fontWeight: 700, marginTop: 3, lineHeight: 1.15 },
  track: { height: 5, borderRadius: 3, backgroundColor: COLORS.wash, marginTop: 4 },
  fill: { height: 5, borderRadius: 3 },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  tile: { width: '33.33%', paddingRight: 8, paddingBottom: 8 },
  tileInner: { borderWidth: 0.75, borderColor: COLORS.line, borderRadius: 5, padding: 8, minHeight: 44 },
  tileValue: { fontSize: 11, fontWeight: 600, color: COLORS.ink, marginTop: 2 },

  callout: { borderWidth: 0.75, borderRadius: 5, padding: 9, marginBottom: 10 },
  calloutTitle: { fontSize: 9, fontWeight: 600 },
  calloutBody: { fontSize: 8.5, marginTop: 2 },

  sectionTitle: { fontSize: 13, fontWeight: 700, color: COLORS.ink, marginTop: 16, marginBottom: 2 },
  sectionRule: { height: 0.75, backgroundColor: COLORS.line, marginBottom: 8 },
  subTitle: { fontSize: 9.5, fontWeight: 600, color: COLORS.ink, marginTop: 10, marginBottom: 4 },
  paragraph: { fontSize: 9, lineHeight: 1.5, color: COLORS.soft },
  muted: { color: COLORS.muted },

  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: COLORS.line, paddingVertical: 4.5, alignItems: 'flex-start' },
  cellLabel: { flex: 1.15, color: COLORS.soft },
  cellValue: { flex: 1, textAlign: 'right', fontWeight: 600, color: COLORS.ink },
  cellNote: { flex: 1.25, paddingLeft: 12, fontSize: 8, color: COLORS.muted },
  headRow: { flexDirection: 'row', borderBottomWidth: 0.75, borderBottomColor: COLORS.faint, paddingBottom: 3, marginBottom: 1 },
  headText: { fontSize: 7.5, fontWeight: 600, color: COLORS.muted },

  bulletRow: { flexDirection: 'row', marginBottom: 3 },
  bullet: { width: 10, color: COLORS.faint },
  bulletText: { flex: 1 },

  twoCol: { flexDirection: 'row' },
  col: { flex: 1 },
  card: { borderLeftWidth: 2.5, paddingLeft: 9, paddingVertical: 2, marginBottom: 9 },
  cardTitle: { fontSize: 9, fontWeight: 600, color: COLORS.ink, marginBottom: 2 },

  newsRow: { borderBottomWidth: 0.5, borderBottomColor: COLORS.line, paddingVertical: 5 },
  newsTitle: { fontSize: 9, fontWeight: 600, color: COLORS.ink },
  small: { fontSize: 8, color: COLORS.muted },
  link: { fontSize: 8, color: COLORS.accentInk, textDecoration: 'none' },
  disclaimer: { marginTop: 14, padding: 9, backgroundColor: COLORS.canvas, borderRadius: 5, fontSize: 8, color: COLORS.muted, lineHeight: 1.5 },
});

// ------------------------------------------------------------------------------------------------------------------
// primitives

const NA = 'Not available';

function Heading({ children }: { children: string }) {
  return (
    <View minPresenceAhead={70}>
      <Text style={s.sectionTitle}>{children}</Text>
      <View style={s.sectionRule} />
    </View>
  );
}

function SubHeading({ children }: { children: string }) {
  return (
    <Text style={s.subTitle} minPresenceAhead={40}>
      {children}
    </Text>
  );
}

function Paragraph({ children }: { children: string }) {
  return <Text style={s.paragraph}>{children}</Text>;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={s.bulletRow} wrap={false}>
          <Text style={s.bullet}>•</Text>
          <Text style={s.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function Callout({ tone, title, children }: { tone: PdfTone; title: string; children: string }) {
  const t = TONES[tone];
  return (
    <View style={[s.callout, { backgroundColor: t.bg, borderColor: t.border }]} wrap={false}>
      <Text style={[s.calloutTitle, { color: t.text }]}>{title}</Text>
      <Text style={[s.calloutBody, { color: t.text }]}>{children}</Text>
    </View>
  );
}

/** Label / value / note table. A missing value reads "Not available"; a real 0 stays "0". */
function Table({ rows, title }: { rows: Row[]; title?: string }) {
  return (
    <View wrap={false}>
      {title && <Text style={s.subTitle}>{title}</Text>}
      {rows.map((row, i) => (
        <View key={i} style={s.tableRow} wrap={false}>
          <Text style={s.cellLabel}>{row.label}</Text>
          <Text style={[s.cellValue, row.value === undefined ? { color: COLORS.faint, fontWeight: 400 } : row.tone ? { color: TONES[row.tone].text } : {}]}>
            {row.value === undefined ? NA : row.value}
          </Text>
          <Text style={s.cellNote}>{row.note ?? ''}</Text>
        </View>
      ))}
    </View>
  );
}

function Tile({ label, value, tone, note }: { label: string; value?: string; tone?: PdfTone; note?: string }) {
  return (
    <View style={s.tile} wrap={false}>
      <View style={s.tileInner}>
        <Text style={s.label}>{label}</Text>
        <Text style={[s.tileValue, value === undefined ? { color: COLORS.faint, fontWeight: 400 } : tone ? { color: TONES[tone].text } : {}]}>{value ?? NA}</Text>
        {note && <Text style={[s.small, { marginTop: 1 }]}>{note}</Text>}
      </View>
    </View>
  );
}

function Meter({ percent, color }: { percent: number; color: string }) {
  return (
    <View style={s.track}>
      <View style={[s.fill, { width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: color }]} />
    </View>
  );
}

/** A bar with a position marker (52-week range, RSI). Drawn from the metrics given, nothing else. */
function Scale({ position, left, right, caption, bandFrom, bandTo }: { position: number; left: string; right: string; caption: string; bandFrom?: number; bandTo?: number }) {
  const p = Math.max(0, Math.min(100, position));
  return (
    <View style={{ marginBottom: 10 }} wrap={false}>
      <Text style={s.label}>{caption}</Text>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: COLORS.wash, marginTop: 6, marginBottom: 6, position: 'relative' }}>
        {bandFrom !== undefined && bandTo !== undefined && (
          <View style={{ position: 'absolute', left: `${bandFrom}%`, width: `${bandTo - bandFrom}%`, top: 0, height: 6, backgroundColor: '#cbd5e1', borderRadius: 3 }} />
        )}
        <View style={{ position: 'absolute', left: `${p}%`, marginLeft: -5, top: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.ink, borderWidth: 1.5, borderColor: COLORS.white }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={s.small}>{left}</Text>
        <Text style={s.small}>{right}</Text>
      </View>
    </View>
  );
}

function shorten(text: string, max = 88): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// ------------------------------------------------------------------------------------------------------------------

export const ReportDocument: React.FC<{ model: PdfReportModel }> = ({ model: m }) => {
  const rec = TONES[m.recommendationTone];
  const risk = m.risk;

  return (
    <Document title={`FinAI Cloud research report: ${m.company} (${m.ticker})`} author="FinAI Cloud" subject="Investment research report" creator="FinAI Cloud" producer="FinAI Cloud">
      <Page size="A4" style={s.page} wrap>
        {/* running header (not on the first page) and footer */}
        {/* The header text is blank on page 1 (which has its own title block). A `render` function on the View itself
            that returned null made react-pdf's layout fail on long reports, so only the Text content is conditional. */}
        <View fixed style={s.runningHeaderBox}>
          <View style={s.runningHeader}>
            <Text style={s.runningHeaderText} render={({ pageNumber }) => (pageNumber > 1 ? 'FinAI Cloud · Investment research report' : ' ')} />
            <Text style={s.runningHeaderText} render={({ pageNumber }) => (pageNumber > 1 ? `${shorten(m.company, 44)} (${m.ticker})` : ' ')} />
          </View>
        </View>
        <View fixed style={s.footerBox}>
          <View style={s.footer}>
            <Text style={s.footerText}>
              {m.ticker} · Generated {m.generatedAt} · For information only, not financial advice
            </Text>
            <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
        </View>

        {/* ================= Executive summary ================= */}
        <View style={s.brandRow}>
          <View>
            <Text style={s.brand}>FinAI Cloud</Text>
            <Text style={s.brandSub}>Multi-agent investment research</Text>
          </View>
          <Text style={s.brandSub}>Generated {m.generatedAt}</Text>
        </View>
        <View style={s.accentRule} />
        <Text style={s.title}>{m.company}</Text>
        <Text style={s.identity}>{m.identity.join('  ·  ')}</Text>

        <View style={s.hero} wrap={false}>
          <View style={s.priceBlock}>
            <Text style={s.label}>Current price</Text>
            <Text style={[s.price, m.price === undefined ? { color: COLORS.faint, fontSize: 16, fontWeight: 400 } : {}]}>{m.price ?? NA}</Text>
            {m.price !== undefined && m.priceCurrency !== '' && <Text style={s.priceCurrency}>{m.priceCurrency}</Text>}
          </View>
          <View style={[s.recBox, { backgroundColor: rec.bg, borderColor: rec.border }]}>
            <Text style={s.label}>Recommendation</Text>
            <Text style={[s.recText, { color: rec.text }]}>{m.recommendation ?? NA}</Text>
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={s.label}>Confidence</Text>
                <Text style={[s.label, { color: COLORS.ink, fontWeight: 600 }]}>{m.confidence !== undefined ? `${Math.round(m.confidence * 100)}%` : NA}</Text>
              </View>
              {m.confidence !== undefined && <Meter percent={m.confidence * 100} color={COLORS.ink} />}
            </View>
          </View>
        </View>

        <View style={s.tiles}>
          {m.summaryRows.map((row) => (
            <Tile key={row.label} label={row.label} value={row.value} tone={row.tone} note={row.note} />
          ))}
        </View>

        <Callout tone={m.sourceNotice.tone} title={m.sourceNotice.title}>
          {m.sourceNotice.body}
        </Callout>
        {m.partialRunWarning && (
          <Callout tone="danger" title="Incomplete run">
            {m.partialRunWarning}
          </Callout>
        )}

        <Heading>Executive summary</Heading>
        {m.executiveSummary ? <Paragraph>{m.executiveSummary}</Paragraph> : <Text style={[s.paragraph, s.muted]}>No decision summary is available for this run.</Text>}

        <Table title="Report and data status" rows={m.statusRows} />

        {/* ================= Market and technical analysis ================= */}
        <Heading>Market and technical analysis</Heading>
        <Table title="Market snapshot" rows={m.market.rows} />

        <SubHeading>Technical indicators</SubHeading>
        <View style={s.twoCol}>
          <View style={[s.col, { paddingRight: 14 }]}>
            {m.market.range ? (
              <Scale position={m.market.range.position} left={`Low ${m.market.range.low}`} right={`High ${m.market.range.high}`} caption={`52-week range position: ${m.market.range.position.toFixed(0)}%`} />
            ) : (
              <Text style={[s.small, { marginBottom: 10 }]}>52-week range position: not available (the range could not be computed from the data received).</Text>
            )}
          </View>
          <View style={[s.col, { paddingLeft: 14 }]}>
            {m.market.rsi !== undefined ? (
              <Scale position={m.market.rsi} left="Oversold below 30" right="Overbought above 70" caption={`RSI (14): ${m.market.rsi.toFixed(1)}`} bandFrom={30} bandTo={70} />
            ) : (
              <Text style={[s.small, { marginBottom: 10 }]}>RSI: not available.</Text>
            )}
          </View>
        </View>
        {m.market.priceVsAverages.length > 0 && <Table rows={m.market.priceVsAverages} />}
        {m.market.sentiment && (
          <View style={{ marginTop: 8 }} wrap={false}>
            <Text>
              <Text style={s.muted}>Technical sentiment: </Text>
              <Text style={{ fontWeight: 600, color: COLORS.ink }}>{m.market.sentiment}</Text>
            </Text>
          </View>
        )}
        {m.market.summary && (
          <>
            <SubHeading>Technical summary</SubHeading>
            <Paragraph>{m.market.summary}</Paragraph>
          </>
        )}

        {/* ================= Fundamentals and market intelligence ================= */}
        <Heading>Fundamental analysis and market intelligence</Heading>
        <Table title="Fundamentals" rows={m.fundamentals.rows} />
        {m.fundamentals.summary && (
          <>
            <SubHeading>Financial and business summary</SubHeading>
            <Paragraph>{m.fundamentals.summary}</Paragraph>
          </>
        )}
        {m.fundamentals.website && (
          <Text style={{ marginTop: 6 }}>
            <Text style={s.small}>Corporate website: </Text>
            <Link src={m.fundamentals.website} style={s.link}>
              {shorten(m.fundamentals.website, 70)}
            </Link>
          </Text>
        )}

        <SubHeading>News and market sentiment</SubHeading>
        {m.news.length > 0 ? (
          <View>
            <Text style={[s.small, { marginBottom: 2 }]}>
              {m.news.length} headline{m.news.length === 1 ? '' : 's'} retrieved. Headlines are listed as received; the report does not score each article individually.
            </Text>
            {m.news.map((n, i) => (
              <View key={i} style={s.newsRow} wrap={false}>
                <Text style={s.newsTitle}>{n.title}</Text>
                {n.date && <Text style={s.small}>{n.date}</Text>}
                {n.url && (
                  <Link src={n.url} style={s.link}>
                    {shorten(n.url)}
                  </Link>
                )}
              </View>
            ))}
          </View>
        ) : (
          <Text style={[s.paragraph, s.muted]}>No news articles were retrieved for this symbol, so news sentiment could not be assessed.</Text>
        )}

        {m.sources.length > 0 && (
          <>
            <SubHeading>Sources</SubHeading>
            {m.sources.map((src, i) => (
              <View key={i} style={s.bulletRow} wrap={false}>
                <Text style={s.bullet}>•</Text>
                {/^https?:\/\//.test(src) ? (
                  <Link src={src} style={[s.link, { flex: 1 }]}>
                    {shorten(src)}
                  </Link>
                ) : (
                  <Text style={s.bulletText}>{shorten(src, 140)}</Text>
                )}
              </View>
            ))}
          </>
        )}

        <SubHeading>Data limitations and notes</SubHeading>
        {m.dataNotes.length > 0 ? <Bullets items={m.dataNotes} /> : <Text style={[s.paragraph, s.muted]}>The data sources raised no warnings for this report.</Text>}

        {/* ================= Strategy and risk ================= */}
        <Heading>Strategy and risk assessment</Heading>
        {m.strategy ? (
          <>
            <View style={[s.card, { borderLeftColor: COLORS.accent }]} wrap={false}>
              <Text style={s.cardTitle}>Bull case</Text>
              <Text style={s.paragraph}>{m.strategy.bull ?? NA}</Text>
            </View>
            <View style={[s.card, { borderLeftColor: COLORS.danger }]} wrap={false}>
              <Text style={s.cardTitle}>Bear case</Text>
              <Text style={s.paragraph}>{m.strategy.bear ?? NA}</Text>
            </View>
            {m.strategy.approach && (
              <View style={{ backgroundColor: COLORS.canvas, borderRadius: 5, padding: 9, marginBottom: 6 }} wrap={false}>
                <Text style={s.label}>Suggested investment approach</Text>
                <Text style={{ fontSize: 10, fontWeight: 600, color: COLORS.ink, marginTop: 2 }}>{m.strategy.approach}</Text>
              </View>
            )}
            <Table title="Price levels" rows={[...m.strategy.levels, ...m.strategy.detail]} />
            {m.strategy.reasoning && (
              <>
                <SubHeading>Strategy reasoning</SubHeading>
                <Paragraph>{m.strategy.reasoning}</Paragraph>
              </>
            )}
            {m.strategy.catalysts.length > 0 && (
              <>
                <SubHeading>Catalysts</SubHeading>
                <Bullets items={m.strategy.catalysts} />
              </>
            )}
          </>
        ) : (
          <Text style={[s.paragraph, s.muted]}>No strategy report is available for this run.</Text>
        )}

        {risk ? (
          <>
            <Table title="Risk breakdown" rows={risk.rows} />
            <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }} wrap={false}>
              <View style={{ flex: 1, paddingRight: 14 }}>
                <Text style={s.label}>Total risk score (higher means more risk)</Text>
                {risk.score !== undefined && <Meter percent={risk.score} color={TONES[risk.ratingTone].solid} />}
              </View>
              <Text style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{risk.score !== undefined ? `${risk.score.toFixed(0)} / 100` : NA}</Text>
            </View>
            {risk.rating && (
              <Text style={{ marginTop: 4 }}>
                <Text style={s.muted}>Overall rating: </Text>
                <Text style={{ fontWeight: 600, color: TONES[risk.ratingTone].text }}>{risk.rating}</Text>
              </Text>
            )}
            {risk.reasons.length > 0 && (
              <>
                <SubHeading>Why this rating</SubHeading>
                <Bullets items={risk.reasons} />
              </>
            )}
            {risk.weaknesses.length > 0 && (
              <>
                <SubHeading>Weaknesses</SubHeading>
                <Bullets items={risk.weaknesses} />
              </>
            )}
            {risk.recommendations.length > 0 && (
              <>
                <SubHeading>Risk recommendations</SubHeading>
                <Bullets items={risk.recommendations} />
              </>
            )}
          </>
        ) : (
          <>
            <SubHeading>Risk breakdown</SubHeading>
            <Text style={[s.paragraph, s.muted]}>No risk report is available for this run.</Text>
          </>
        )}

        <SubHeading>Explainable AI: decision reasoning</SubHeading>
        {m.explain.reasoning ? <Paragraph>{m.explain.reasoning}</Paragraph> : <Text style={[s.paragraph, s.muted]}>No reasoning trace was provided for this decision.</Text>}
        {m.explain.evidence.length > 0 && (
          <>
            <SubHeading>Supporting evidence</SubHeading>
            <Bullets items={m.explain.evidence} />
          </>
        )}
        {m.explain.nextSteps.length > 0 && (
          <>
            <SubHeading>Recommended next steps</SubHeading>
            <Bullets items={m.explain.nextSteps} />
          </>
        )}

        {/* ================= Execution and transparency ================= */}
        <Heading>Execution and transparency</Heading>
        <View wrap={false}>
        <View style={s.headRow}>
          <Text style={[s.headText, { flex: 1.1 }]}>Agent</Text>
          <Text style={[s.headText, { flex: 0.7 }]}>Status</Text>
          <Text style={[s.headText, { flex: 1.5 }]}>Output generated by</Text>
        </View>
        {m.execution.rows.map((row, i) => (
          <View key={i} style={s.tableRow} wrap={false}>
            <View style={{ flex: 1.1, paddingRight: 8 }}>
              <Text style={{ fontWeight: 600, color: COLORS.ink }}>{row.label}</Text>
              <Text style={s.small}>{row.detail}</Text>
            </View>
            <Text style={{ flex: 0.7, fontWeight: 600, color: TONES[row.statusTone].text }}>{row.status}</Text>
            <Text style={{ flex: 1.5, color: row.source.startsWith('Rule-based') ? COLORS.cautionInk : COLORS.soft }}>{row.source}</Text>
          </View>
        ))}
        </View>

        <Table title="Run timing" rows={m.execution.totals} />
        <Table title="Data retrieval" rows={m.execution.retrieval} />

        {m.execution.errors.length > 0 && (
          <>
            <SubHeading>Errors reported by the workflow</SubHeading>
            <Bullets items={m.execution.errors} />
          </>
        )}

        <SubHeading>Known limitations of this report</SubHeading>
        <Bullets items={m.limitations} />

        <View style={s.disclaimer} wrap={false}>
          <Text>
            Disclaimer: this report is generated by an automated multi-agent research system for informational and educational purposes only. It is not personalised financial, investment, tax or legal advice and
            is not an offer or solicitation to buy or sell any security. Market data may be delayed, incomplete or inaccurate, and analysis marked as rule-based was produced by deterministic rules rather than by an AI
            model. Verify all figures independently and consult a qualified adviser before making investment decisions.
          </Text>
        </View>
      </Page>
    </Document>
  );
};
