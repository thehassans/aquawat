import SystemSettings from '../models/SystemSettings.js';

export const sendOTP = async (phone, otp) => {
  try {
    const settings = await SystemSettings.findOne({ key: 'global' });
    if (!settings || !settings.sms || !settings.sms.enabled) {
      console.log(`[SMS Service] SMS is disabled. OTP for ${phone}: ${otp}`);
      return;
    }

    if (settings.sms.provider === 'twilio') {
      // Simulate Twilio
      console.log(`[Twilio Simulation] Sending OTP ${otp} to ${phone}`);
    } else if (settings.sms.provider === 'custom') {
      // Simulate custom
      console.log(`[Custom SMS Simulation] Sending OTP ${otp} to ${phone}`);
    } else {
      console.log(`[SMS Service] Unknown provider. OTP for ${phone}: ${otp}`);
    }
  } catch (error) {
    console.error('[SMS Service] Error sending OTP:', error);
  }
};
