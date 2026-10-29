import http from 'k6/http';
import { check } from 'k6';

export const options = { vus: 10, duration: '10s' };

export default function () {
  const response = http.get('http://localhost:3000/');
  check(response, { 'returns a rate-limit decision': value => value.status === 200 || value.status === 429 });
}
