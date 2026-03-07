import path from 'path';

export const OTP_EMAIL_LOGO_CID = 'stackable-logo';

export function getOtpEmailInlineAttachments() {
  return [
    {
      filename: 'stackable-symbol.webp',
      path: path.join(process.cwd(), 'public', 'logos', 'stackable-symbol.webp'),
      contentId: OTP_EMAIL_LOGO_CID,
    },
  ];
}
