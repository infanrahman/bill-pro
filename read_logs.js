require('fake-indexeddb/auto');
const Dexie = require('dexie');

async function test() {
    const db = new Dexie('BillingAppDB');
    db.version(6).stores({
        scaleLogs: '++id, scaleIp, action, pluNo, status, createdAt'
    });

    const logs = await db.scaleLogs.orderBy('createdAt').reverse().limit(5).toArray();
    console.log(JSON.stringify(logs, null, 2));
}

test().catch(console.error);
