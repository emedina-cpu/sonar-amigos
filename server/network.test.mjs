import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLocalHost } from '../src/network.js';
test('permite Wi-Fi privada y loopback; rechaza hosts públicos y direcciones inválidas', () => {
  for(const host of ['localhost','127.0.0.1','10.0.2.2','192.168.10.16','172.16.0.1','172.31.255.254']) assert.equal(isLocalHost(host),true,host);
  for(const host of ['8.8.8.8','example.com','192.169.1.1','172.15.1.1','172.32.0.1','192.168.999.1','192.168.1.1.attacker.com']) assert.equal(isLocalHost(host),false,host);
});
