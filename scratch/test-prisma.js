const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing connection...');
    await prisma.$connect();
    console.log('Connected!');
    
    console.log('Testing query...');
    const prices = await prisma.marketPrice.findMany({
      where: { regionId: 'test' }
    });
    console.log('Success! Count:', prices.length);
  } catch (e) {
    console.error('ERROR:', e.message);
    if (e.stack) console.error(e.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();
