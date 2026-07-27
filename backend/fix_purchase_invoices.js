import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Invoice from './models/Invoice.js';

dotenv.config({ path: '.env.production' });

async function fixPurchaseInvoices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const result = await Invoice.updateMany(
      { flow: 'purchase', status: 'draft' },
      { $set: { status: 'approved' } }
    );

    console.log(`Updated ${result.modifiedCount} purchase invoices from draft to approved.`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from DB');
  }
}

fixPurchaseInvoices();
