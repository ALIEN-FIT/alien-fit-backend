import axios from 'axios';
import { env } from './env.js';

type SupportedLang = 'en' | 'ar';

function resolveTemplateLanguageCode(lang: SupportedLang): string {
    if (lang === 'ar') {
        return env.WHATSAPP_OTP_LANG_AR ?? 'ar';
    }
    return env.WHATSAPP_OTP_LANG_EN ?? 'en_US';
}

export async function sendWhatsAppOtpTemplate(params: {
    toE164: string;
    otp: string;
    lang: SupportedLang;
}): Promise<void> {
    const accessToken = env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
    const templateName = env.WHATSAPP_OTP_TEMPLATE_NAME;

    if (!accessToken || !phoneNumberId || !templateName) {
        throw new Error('WhatsApp OTP is not configured');
    }

    const to = params.toE164.startsWith('+') ? params.toE164.slice(1) : params.toE164;
    const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

    await axios.post(
        url,
        {
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
                name: templateName,
                language: {
                    code: resolveTemplateLanguageCode(params.lang),
                },
                components: [
                    {
                        type: 'body',
                        parameters: [{ type: 'text', text: params.otp }],
                    },
                ],
            },
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        }
    );
}
