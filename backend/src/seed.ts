import { prisma } from './config/prisma.js';

async function main() {
  console.log('[Seed] Seeding initial database data...');

  const user = await prisma.user.upsert({
    where: { email: 'demo@reachinbox.ai' },
    update: {},
    create: {
      id: 'demo-user-id',
      email: 'demo@reachinbox.ai',
      name: 'ReachInbox Demo User',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=reachinbox',
      slackConfig: {
        create: {
          webhookUrl: process.env.SLACK_DEFAULT_WEBHOOK_URL || null,
          channel: '#reachinbox-alerts',
          isActive: Boolean(process.env.SLACK_DEFAULT_WEBHOOK_URL),
        },
      },
    },
  });

  console.log(`[Seed] Seeded user: ${user.email} (${user.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
