import { useState } from 'react';
import Reveal from './Reveal';

const TRACKS = [
  ['Models', 'Model releases and capability updates'],
  ['Research', 'Papers, methods and evaluations'],
  ['Open source', 'Open weights, libraries and frameworks'],
  ['Companies', 'Products and organizational developments'],
  ['Agents', 'Systems that plan and carry out tasks'],
  ['Robotics', 'Embodied AI and autonomous machines'],
  ['Infrastructure', 'Compute platforms and deployment'],
  ['Policy', 'AI regulation and public policy'],
  ['Developer tools', 'AI coding and developer workflows'],
  ['Hardware', 'AI chips and computing systems'],
];
export function TrackingIndex() {
  const [selected, setSelected] = useState(0);
  return <Reveal className="tracking-index">
    <div className="tracking-head"><h3>What the system tracks</h3><span className="m-label">Coverage index</span></div>
    <div className="tracking-options" aria-label="Coverage areas">
      {TRACKS.map(([name, description], i) => <button key={name} aria-pressed={selected === i} title={description} onClick={() => setSelected(i)}><span className="track-no" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>{name}<span aria-hidden="true">↗</span></button>)}
    </div>
    <p className="tracking-description" aria-live="polite"><b>{TRACKS[selected][0]}</b> / {TRACKS[selected][1]}</p>
  </Reveal>;
}

export function FeedComparison() {
  return <Reveal className="feed-comparison">
    <div><span className="m-label">A conventional article feed</span><ul><li>Repeated headlines</li><li>Context spread across tabs</li><li>Significance left to the reader</li></ul></div>
    <div><span className="m-label"><span className="product-name">AI News Aggregator</span></span><ul><li>Related coverage in one event</li><li>Sources and evidence together</li><li>Summary and significance in view</li></ul></div>
  </Reveal>;
}

export function SourceSnapshot({ status }) {
  const values = [['Registered', status?.sources?.total], ['Active', status?.sources?.enabled], ['Healthy', status?.sources?.healthy]];
  return <dl className="source-snapshot" aria-label="Source status snapshot">
    {values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{typeof value === 'number' ? value : '—'}</dd></div>)}
    <div className="snapshot-note"><dt>Availability</dt><dd>{status ? 'Latest API snapshot' : 'Live status unavailable'}</dd></div>
  </dl>;
}

export function EventTransformation() {
  return <div className="event-example">
    <p className="example-disclaimer m-label">Illustrative example / not a live event</p>
    <div className="example-flow">
      <div className="example-articles">
        <h3>Four reports</h3>
        {['Lab announcement: a new model', 'Technology desk: release details', 'Research publication: the same release', 'Developer publication: what is available'].map((text, i) => <div className="example-article" key={text}><span aria-hidden="true">0{i + 1}</span>{text}</div>)}
      </div>
      <div className="example-process"><span className="m-label">Shared development</span><strong><span>Match</span><span>Group</span><span>Explain</span></strong><span className="example-transfer" aria-hidden="true">→</span><p>Different documents. One underlying release.</p></div>
      <article className="example-record">
        <span className="m-label">One event record</span><h3>A lab releases a new model</h3>
        <p><b>What happened</b><br />The lab announced a model. Related reporting is grouped with the announcement.</p>
        <p><b>Why it matters</b><br />Readers can compare the stated capabilities and availability without reopening every report.</p>
        <dl><div><dt>Display source</dt><dd>Lab announcement</dd></div><div><dt>Supporting coverage</dt><dd>Three reports retained</dd></div></dl>
        <span className="example-caveat">Official sourcing shows proximity to the announcement; it does not verify every claim.</span>
      </article>
    </div>
  </div>;
}
