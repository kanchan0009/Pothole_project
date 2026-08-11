import { contactService } from '../src/services/contact.service.js';
import { prisma } from '../src/config/prisma.js';

async function run() {
  try {
    // 1. Create a dummy user
    const user = await prisma.user.create({
      data: {
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
      }
    });

    // 2. Create a dummy message
    const msg = await prisma.contactMessage.create({
      data: {
        name: 'Test',
        email: 'test@example.com',
        subject: 'Hello',
        message: 'World',
      }
    });

    console.log('Created message:', msg.id);

    // 3. Try to reply
    await contactService.replyMessage(msg.id, 'Test reply');
    console.log('Reply successful');
    
    // 4. Clean up
    await prisma.user.delete({ where: { id: user.id } });
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
