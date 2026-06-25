import { baseTemplate, ctaButton, greeting, signoff } from './base.template';

interface MessageItem {
  senderName: string;
  preview: string;
  chatroomId: string;
}

export function getNewMessagesEmailTemplate(params: {
  firstName: string;
  messages: MessageItem[];
  frontendUrl: string;
}): { subject: string; html: string } {
  const { firstName, messages, frontendUrl } = params;

  const subject =
    messages.length === 1
      ? `New message from ${messages[0].senderName} — iExcelo`
      : `${messages.length} new messages waiting for you — iExcelo`;

  const messageRows = messages
    .map(
      (m) => /* html */ `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #F2F4F7;" class="divider">
        <!-- Avatar + sender name -->
        <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:6px;">
          <tr>
            <td style="vertical-align:middle;">
              <div style="width:36px;height:36px;background-color:#EFF8FF;border-radius:50%;text-align:center;line-height:36px;display:inline-block;">
                <span style="font-size:15px;font-weight:700;color:#007FFF;">${m.senderName.charAt(0).toUpperCase()}</span>
              </div>
            </td>
            <td style="padding-left:10px;vertical-align:middle;">
              <p style="margin:0;font-size:14px;font-weight:700;color:#1a1a1a;" class="body-strong">${m.senderName}</p>
            </td>
          </tr>
        </table>
        <!-- Preview -->
        <p style="margin:0 0 10px;font-size:14px;color:#444444;line-height:1.6;padding-left:46px;" class="body-sub">
          &ldquo;${m.preview}&rdquo;
        </p>
        <!-- Reply link -->
        <table cellpadding="0" cellspacing="0" role="presentation" style="margin-left:46px;">
          <tr>
            <td style="background-color:#EFF8FF;border-radius:6px;padding:7px 16px;">
              <a href="${frontendUrl}/messages/${m.chatroomId}" style="font-size:13px;font-weight:600;color:#007FFF;text-decoration:none;">
                Reply &rarr;
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`,
    )
    .join('');

  const body = /* html */ `
    ${greeting(firstName)}

    <p class="body-sub" style="margin:0 0 24px;font-size:15px;color:#444444;line-height:1.75;">
      ${
        messages.length === 1
          ? `<strong>${messages[0].senderName}</strong> sent you a message on iExcelo.`
          : `You received <strong>${messages.length} messages</strong> while you were away.`
      }
    </p>

    <!-- Message list -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
      <tbody>
        ${messageRows}
      </tbody>
    </table>

    ${ctaButton('Open All Messages', `${frontendUrl}/messages`)}

    <p class="body-sub" style="margin:0;font-size:13px;color:#98A2B3;text-align:center;line-height:1.6;">
      You're receiving this because you have unread messages on iExcelo.
    </p>

    ${signoff()}
  `;

  return {
    subject,
    html: baseTemplate({ body }),
  };
}
