import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const componentUrl = new URL('../src/components/SituationBand.jsx', import.meta.url);
const source = await readFile(componentUrl, 'utf8');
const transformed = await transformWithOxc(source, componentUrl.pathname, { jsx: { runtime: 'automatic' } });
const code = transformed.code.replace(/from (['"])([^'"]+)\1/g, (_, quote, specifier) => {
    const url = specifier.startsWith('.') ? new URL(specifier + '.js', componentUrl).href : import.meta.resolve(specifier);
    return 'from ' + JSON.stringify(url);
});
const { default: SituationBand } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const render = (ingestion, extra = {}) => renderToStaticMarkup(React.createElement(SituationBand, {
    status: { sources:{enabled:32}, geminiConfigured:true, ingestion },
    storyCount:4, lastUpdated:new Date().toISOString(), ...extra,
}));
test('stale ingestion stays overdue even with a recent event update', () => {
    const html=render({sourceFetchStatus:'stale',lastSuccessfulSourceFetchAt:'2020-01-01T00:00:00Z'});
    assert.match(html,/>Overdue</);assert.doesNotMatch(html,/>Current</);
    assert.doesNotMatch(html,/Analysis engine|Configured/);
});
test('current and unknown freshness come exclusively from ingestion status', () => {
    assert.match(render({sourceFetchStatus:'current',lastSuccessfulSourceFetchAt:new Date().toISOString()}),/>Current</);
    assert.match(render(undefined),/>Unknown</);
    assert.doesNotMatch(render(undefined),/>Current</);
});
