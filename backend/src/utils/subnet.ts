/** Нормализует IP, убирая маппинг IPv6->IPv4 (::ffff:1.2.3.4 -> 1.2.3.4) и пробелы. */
export function normalizeIp(raw: string): string {
  let ip = String(raw).trim();
  if (ip.startsWith('::ffff:') && ip.includes('.')) {
    ip = ip.slice('::ffff:'.length);
  }
  return ip;
}

/** Превращает IP (v4 или v6) в 128-битное bigint. Возвращает null для некорректного ввода. */
export function parseIp(input: string): bigint | null {
  const raw = normalizeIp(input);

  if (raw.includes('.')) {
    const parts = raw.split('.');
    if (parts.length !== 4) return null;
    let value = 0n;
    for (const p of parts) {
      const n = Number(p.trim());
      if (!Number.isInteger(n) || n < 0 || n > 255) return null;
      value = (value << 8n) | BigInt(n);
    }
    return value;
  }

  if (raw.includes(':')) {
    let ip = raw;
    const doubleColon = ip.indexOf('::');
    const left = doubleColon === -1 ? ip : ip.slice(0, doubleColon);
    const right = doubleColon === -1 ? '' : ip.slice(doubleColon + 2);
    const leftParts = left === '' ? [] : left.split(':');
    const rightParts = right === '' ? [] : right.split(':');

    let groups: string[];
    if (doubleColon === -1) {
      groups = leftParts;
    } else {
      const missing = 8 - leftParts.length - rightParts.length;
      if (missing < 1) return null;
      groups = [...leftParts, ...Array(missing).fill('0'), ...rightParts];
    }
    if (groups.length !== 8) return null;

    let value = 0n;
    for (const g of groups) {
      const n = Number.parseInt(g.trim(), 16);
      if (!Number.isInteger(n) || n < 0 || n > 0xffff) return null;
      value = (value << 16n) | BigInt(n);
    }
    return value;
  }

  return null;
}

export interface ParsedCidr {
  base: bigint;
  prefix: number;
}

/** Разбирает одиночный IP (av-prefix /32, /128) или подсеть вида 1.2.3.0/24. */
export function parseCidr(value: string): ParsedCidr | null {
  let raw = normalizeIp(value).replace(/\s+/g, '');
  const slash = raw.lastIndexOf('/');
  const addr = slash === -1 ? raw : raw.slice(0, slash);
  const base = parseIp(addr);
  if (base === null) return null;

  let prefix: number;
  if (slash === -1) {
    prefix = addr.includes(':') ? 128 : 32;
  } else {
    prefix = Number.parseInt(raw.slice(slash + 1), 10);
  }
  const max = addr.includes(':') ? 128 : 32;
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > max) return null;
  return { base, prefix };
}

/** Проверяет, попадает ли IP в подсеть/CIDR. */
export function ipInNet(ip: string, cidrValue: string): boolean {
  const parsed = parseCidr(cidrValue);
  const target = parseIp(ip);
  if (!parsed || target === null) return false;

  // Биты относительны семейству адреса (IPv4=32, IPv6=128). IPv4 храним в младших 32 битах.
  const isV6 = cidrValue.includes(':');
  const bits = isV6 ? 128 : 32;
  const hostBits = bits - parsed.prefix;
  const hostMask = hostBits <= 0 ? 0n : (1n << BigInt(hostBits)) - 1n;
  return (parsed.base & ~hostMask) === (target & ~hostMask);
}

/** Принадлежат ли два IPv4 адреса одной подсети /24. Для IPv6 возвращает false. */
export function sameSubnet24(a: string, b: string): boolean {
  const target = parseIp(a);
  const other = parseIp(b);
  if (target === null || other === null) return false;
  if (a.includes(':') || b.includes(':')) return false;
  return (target & 0xffffff00n) === (other & 0xffffff00n);
}

/** Валидный одиночный IP (тип 'ip'). */
export function isValidIp(value: string): boolean {
  return parseIp(value) !== null;
}

/** Валидный IP или подсеть (тип 'subnet'). */
export function isValidCidr(value: string): boolean {
  return parseCidr(value) !== null;
}

/** Строгая проверка для значений списков: одиночный IP или валидный CIDR. */
export function isValidListValue(value: string, type: 'ip' | 'subnet'): boolean {
  if (type === 'ip') return isValidIp(value);
  return isValidCidr(value);
}