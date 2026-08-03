import { http, HttpResponse } from 'msw';
import { packsActiveMbs, riskMeasuresFor, regimeFor, portfolioSnapshot } from '../factories/packs';

export const handlers = [
  http.get('/api/apos/packs/active', () => HttpResponse.json(packsActiveMbs())),
  http.get('/api/apos/portfolio/snapshot', () => HttpResponse.json(portfolioSnapshot())),
  http.get('/api/apos/risk/measures', () => HttpResponse.json(riskMeasuresFor('mbs'))),
  http.get('/api/apos/regime/current', () => HttpResponse.json(regimeFor('mbs'))),
];
