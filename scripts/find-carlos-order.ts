import 'dotenv/config';
import postgres from 'postgres';

const url = process.env.DATABASE_URL || process.env.FLEET_DATABASE_URL;
if (!url) {
  console.error('NO_DB');
  process.exit(1);
}

const sql = postgres(url, { max: 1, connect_timeout: 20, idle_timeout: 5 });

async function main() {
  const platform = await sql`
    SELECT payload FROM platform_state WHERE id = 1
  `;
  const payload = (platform[0]?.payload ?? {}) as any;
  const users = Array.isArray(payload.users) ? payload.users : [];
  const orders = Array.isArray(payload.orders) ? payload.orders : [];

  const carlosUsers = users.filter((u: any) =>
    String(u.name || '').toLowerCase().includes('carlos')
  );
  console.log(
    'USERS_CARLOS',
    JSON.stringify(
      carlosUsers.map((u: any) => ({ id: u.id, name: u.name, email: u.email })),
      null,
      2
    )
  );

  const carlosIds = new Set(carlosUsers.map((u: any) => u.id));
  const related = orders.filter(
    (o: any) =>
      carlosIds.has(o.userId) ||
      String(o.address || '').toLowerCase().includes('carlos') ||
      String(JSON.stringify(o)).toLowerCase().includes('arthur')
  );

  // Also dump recent pending/confirmado orders briefly
  const open = orders
    .filter((o: any) =>
      ['pendente', 'confirmado', 'preparando'].includes(o.status)
    )
    .sort(
      (a: any, b: any) =>
        +new Date(b.updatedAt || b.createdAt) - +new Date(a.updatedAt || a.createdAt)
    )
    .slice(0, 15)
    .map((o: any) => ({
      id: o.id,
      status: o.status,
      userId: o.userId,
      businessName: o.businessName,
      total: o.total,
      createdAt: o.createdAt,
    }));

  console.log('OPEN_ORDERS', JSON.stringify(open, null, 2));
  console.log(
    'RELATED',
    JSON.stringify(
      related.map((o: any) => ({
        id: o.id,
        status: o.status,
        userId: o.userId,
        businessName: o.businessName,
        paymentConfirmed: o.paymentConfirmed,
      })),
      null,
      2
    )
  );

  await sql.end({ timeout: 2 });
}

main().catch(async (e) => {
  console.error('FAIL', e?.message || e);
  try {
    await sql.end({ timeout: 1 });
  } catch {}
  process.exit(1);
});
